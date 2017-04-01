const $i = document.getElementById.bind(document)

onload()

function onload(){
  const shortcutsTable = $i('shortcutsTable')
  $i('save_btn').addEventListener('click', save)
  $i('restore_defaults_btn').addEventListener('click', (event) => {
    chrome.storage.sync.set({'shortcuts': default_shortcuts} )
  })
  $i('new_btn').addEventListener('click', (event) => {
    shortcutsTable.appendChild(newShortcutLine())
  })
  chrome.storage.sync.get('shortcuts', ({shortcuts}) => {
    const shortcutLines = buildShortcuts(shortcuts)
    for(line of shortcutLines){
      shortcutsTable.appendChild(line)
    }
    [...document.querySelectorAll('.remove_btn')].forEach((removeBtnNode) => {
      removeBtnNode.addEventListener('click', removeShortcutLine)
    })
  })
}

function removeShortcutLine(event){
  const tr = event.target.parentNode.parentNode
  tr.parentNode.removeChild(tr)
}

function newShortcutLine(){
  const template = $i('templateKeyOption').cloneNode(true);
  template.hidden = false
  template.id = undefined
  template.querySelector('.remove_btn').addEventListener('click',removeShortcutLine)
  return template
}

function buildShortcuts(shortcuts = default_shortcuts){
  return shortcuts.map((shortcut) => {
    template = newShortcutLine()
    template.querySelector('.val_name').value = shortcut.name
    template.querySelector('.val_key').value = shortcut.key
    template.querySelector('.val_path').value = shortcut.path
    return template
  })
}

function save(event){
  const form = $i('shortcutsForm')
  if(!form.checkValidity()){
    const targetClassList = event.target.classList
    if(targetClassList.contains('shake-btn')){ 
      targetClassList.remove('shake-btn')
      void event.target.offsetWidth // hack to restart animation (forces reflow)
    }
    targetClassList.add('shake-btn')
    event.preventDefault()
    return 
  } 
  const toSetting = (trNode) => {
    let path = trNode.querySelector('.val_path').value
    path = path[0] == '/' ? path : '/' + path
    return {name : trNode.querySelector('.val_name').value,
         key : trNode.querySelector('.val_key').value,
         path : path
       }
  }
  const shortcuts = [...document.getElementById('shortcutsTable').children]      
  chrome.storage.sync.set({'shortcuts': shortcuts.map(toSetting)} )
}

function remove(event) {
  debugger
  const tr = event.target.parentNode.parentNode
  tr.parentNode.removeChild(tr)
}
