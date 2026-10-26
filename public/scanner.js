/* Local image decoding with native detection plus a bundled ZXing fallback.
   Only the resulting number is sent through our API to Open Food Facts. */
(() => {
  let revision=0,controller=null,barcode=null,lookupProduct=null;
  const status=message=>{document.getElementById('barcodeStatus').textContent=message;};
  const result=document.getElementById('recognizedProduct');
  const input=document.getElementById('barcodeInput');
  const name=document.getElementById('productName');
  const confirm=document.getElementById('productConfirm');
  const lookupButton=document.getElementById('lookupBarcode');
  function busy(value){lookupButton.disabled=value;document.getElementById('saveProduct').disabled=value;document.getElementById('productForm').setAttribute('aria-busy',String(value));}
  function invalidate(clearName=true){
    revision++;controller?.abort();controller=null;barcode=null;
    if(clearName&&lookupProduct&&name.value===lookupProduct.name)name.value='';
    lookupProduct=null;confirm.checked=false;result.hidden=true;result.replaceChildren();busy(false);
    return revision;
  }
  function render(product){
    result.replaceChildren();
    const heading=document.createElement('strong');heading.textContent='Product found: '+product.name;
    const details=document.createElement('p');details.textContent=[product.brands,product.quantity].filter(Boolean).join(' · ');
    const source=document.createElement('a');source.href=product.sourceUrl;source.target='_blank';source.rel='noreferrer';source.textContent='Source: Open Food Facts';
    result.append(heading,details,source);result.hidden=false;
  }
  async function lookup(code,token){
    busy(true);status('Looking up barcode '+code+' in Open Food Facts…');
    controller=new AbortController();
    try{
      const response=await fetch('/api/barcode/'+encodeURIComponent(code),{signal:controller.signal});
      const data=await response.json();if(token!==revision)return;
      if(!response.ok)throw new Error(data.error||'Product lookup failed. Enter the details manually.');
      lookupProduct=data.product;barcode=code;name.value=data.product.name;confirm.checked=false;
      if(!['food','drink'].includes(document.getElementById('productType').value))document.getElementById('productType').value='food';
      render(data.product);status('Product identified. Check the package, name, and category, then confirm before saving.');
    }catch(error){if(token!==revision||error.name==='AbortError')return;status(error.message||'Lookup failed. Enter and confirm the product manually.');}
    finally{if(token===revision){busy(false);controller=null;}}
  }
  async function decode(file){
    if('BarcodeDetector' in window){
      let bitmap;
      try{
        const formats=await BarcodeDetector.getSupportedFormats();
        const supported=['ean_13','ean_8','upc_a'].filter(f=>formats.includes(f));
        if(supported.length){bitmap=await createImageBitmap(file);const found=await new BarcodeDetector({formats:supported}).detect(bitmap);if(found.length===1&&/^\d{8,14}$/.test(found[0].rawValue))return found[0].rawValue;if(found.length>1)throw new Error('Multiple barcodes found. Photograph one barcode or type its number.');}
      }catch(error){if(error.message.startsWith('Multiple barcodes'))throw error;}finally{bitmap?.close();}
    }
    if(!window.ZXing)throw new Error('The barcode decoder did not load. Reload, or type the barcode number.');
    const hints=new Map([[ZXing.DecodeHintType.POSSIBLE_FORMATS,[ZXing.BarcodeFormat.EAN_13,ZXing.BarcodeFormat.EAN_8,ZXing.BarcodeFormat.UPC_A]],[ZXing.DecodeHintType.TRY_HARDER,true]]);
    const reader=new ZXing.BrowserMultiFormatReader(hints);
    const url=URL.createObjectURL(file);
    try{return (await reader.decodeFromImageUrl(url)).getText();}
    catch{throw new Error('No readable barcode found. Try a sharp, well-lit photo with all bars visible, type the barcode, or enter the product manually.');}
    finally{reader.reset();URL.revokeObjectURL(url);}
  }
  async function scan(file){
    const token=invalidate();input.value='';busy(true);status('Reading the barcode locally…');
    try{const code=await decode(file);if(token!==revision)return;input.value=code;await lookup(code,token);}
    catch(error){if(token===revision)status(error.message);}
    finally{if(token===revision)busy(false);}
  }
  lookupButton.addEventListener('click',()=>{
    const code=input.value.trim();const token=invalidate();
    if(!/^(?:\d{8}|\d{12,14})$/.test(code)){status('Enter an 8, 12, 13, or 14 digit EAN/UPC number, or use manual entry.');return;}
    lookup(code,token);
  });
  input.addEventListener('input',()=>{invalidate();status('Barcode changed. Look it up again, or enter and confirm the product manually.');});
  name.addEventListener('input',()=>{confirm.checked=false;if(controller)invalidate(false);});
  document.getElementById('productType').addEventListener('change',()=>{confirm.checked=false;if(controller)invalidate(false);});
  window.CareScan={scan,reset(){invalidate();input.value='';status('Choose a clear barcode photo, or enter its number below.');},getBarcode:()=>barcode};
})();
