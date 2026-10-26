const CODE = /^(?:\d{8}|\d{12,14})$/;
function validBarcode(code) {
  if(typeof code!=='string'||!CODE.test(code))return false;
  const digits=[...code].map(Number);const check=digits.pop();
  const total=digits.reverse().reduce((sum,d,i)=>sum+d*(i%2===0?3:1),0);
  return (10-total%10)%10===check;
}
function failure(status,message){return Object.assign(new Error(message),{status});}
function createLookup(fetcher=fetch) {
  const cache=new Map();
  return async code=>{
    if(!validBarcode(code))throw failure(400,'Enter a valid EAN/UPC barcode (8, 12, 13, or 14 digits including its check digit).');
    const cached=cache.get(code);if(cached&&cached.until>Date.now())return cached.product;
    let response;
    try {
      response=await fetcher(`https://world.openfoodfacts.org/api/v2/product/${code}.json?fields=code,product_name,product_name_en,brands,quantity`,{headers:{'User-Agent':'CareCard/1.0 (local student health journal; https://openfoodfacts.org)','Accept':'application/json'},signal:AbortSignal.timeout(8000),redirect:'error'});
    }catch{throw failure(503,'Open Food Facts is unavailable or timed out. Try again or enter the product manually.');}
    if(response.status===404)throw failure(404,'This barcode was not found in Open Food Facts. Enter and confirm the product manually.');
    if(response.status===429)throw failure(503,'Open Food Facts is busy. Please wait before trying again, or use manual entry.');
    if(!response.ok)throw failure(503,'Open Food Facts could not complete the lookup. Use manual entry or try again.');
    let data;try{data=await response.json();}catch{throw failure(503,'Open Food Facts returned an unreadable response. Use manual entry.');}
    const raw=data?.product;
    const name=typeof raw?.product_name_en==='string'&&raw.product_name_en.trim()?raw.product_name_en:raw?.product_name;
    if(data?.status!==1||typeof name!=='string'||!name.trim())throw failure(404,'No product name was available for this barcode. Enter and confirm the product manually.');
    const product={barcode:code,name:name.trim().slice(0,120),brands:typeof raw.brands==='string'?raw.brands.slice(0,160):'',quantity:typeof raw.quantity==='string'?raw.quantity.slice(0,80):'',source:'Open Food Facts',sourceUrl:`https://world.openfoodfacts.org/product/${code}`};
    if(cache.size>=100)cache.delete(cache.keys().next().value);
    cache.set(code,{product,until:Date.now()+3600000});return product;
  };
}
module.exports={validBarcode,createLookup};
