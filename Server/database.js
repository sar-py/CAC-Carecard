const fs = require('node:fs');
const path = require('node:path');
function createStore(directory) {
  fs.mkdirSync(directory, {recursive:true});
  const file = path.join(directory,'entries.json');
  let entries = fs.existsSync(file) ? JSON.parse(fs.readFileSync(file,'utf8')) : [];
  if (!Array.isArray(entries)) throw new Error('Invalid journal data. Restore your backup.');
  function commit(next) {
    // A failed disk write never reports success or replaces in-memory state.
    const temp = file + '.tmp';
    fs.writeFileSync(temp, JSON.stringify(next,null,2), {mode:0o600});
    fs.renameSync(temp,file);
    entries = next;
  }
  return { all:() => structuredClone(entries), put(entry) {commit([...entries.filter(e=>e.id!==entry.id),entry]);},
    remove(id) {commit(entries.filter(e=>e.id!==id));}, clear() {commit([]);} };
}
module.exports = {createStore};
