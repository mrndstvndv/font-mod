import './style.css'
import JSZip from 'jszip'

const $ = (id) => document.getElementById(id)
const el = {
  fontUpload: $('font-upload'), mainContent: $('main-content'), initialUpload: $('initial-upload'),
  modId: $('mod-id'), modName: $('mod-name'), modAuthor: $('mod-author'), modVersion: $('mod-version'),
  modDesc: $('mod-desc'), generateBtn: $('generate-btn'), moreOptionsBtn: $('more-options-btn'),
  extraFields: $('extra-fields'), statusContainer: $('status-container'), statusMessage: $('status-message'),
  selectedFontName: $('selected-font-name'), overridesList: $('overrides-list'), addOverrideBtn: $('add-override-btn')
}

const DEFAULT_WEIGHTS = [
  'Roboto-Regular.ttf', 'Roboto-Bold.ttf', 'Roboto-Italic.ttf', 'Roboto-BoldItalic.ttf',
  'Roboto-Medium.ttf', 'Roboto-MediumItalic.ttf', 'Roboto-Light.ttf', 'Roboto-LightItalic.ttf',
  'Roboto-Thin.ttf', 'Roboto-ThinItalic.ttf', 'RobotoStatic-Regular.ttf', 'Roboto-Variable.ttf'
]

el.modAuthor.value = localStorage.getItem('magisk-font-author') || 'Magisk User'
const weightsToUse = JSON.parse(localStorage.getItem('magisk-font-overrides') || JSON.stringify(DEFAULT_WEIGHTS))

const showStatus = (msg, isError = false) => {
  el.statusContainer.classList.remove('hidden')
  el.statusMessage.textContent = msg
  el.statusMessage.style.color = isError ? '#ff4d4d' : '#4facfe'
}

const cleanId = (n) => n.toLowerCase().split('.')[0].replace(/\s+/g, '_').replace(/[^a-z0-9._-]/g, '')
const getBaseName = (n) => n.split('.')[0].replace(/[_-]/g, ' ')

const createOverrideItem = (val = '') => {
  const div = document.createElement('div')
  div.className = 'override-item'
  div.innerHTML = `<input type="text" class="override-input" value="${val}" placeholder="e.g. Roboto-Regular.ttf" /><button class="remove-btn" title="Remove">&times;</button>`
  div.querySelector('.remove-btn').onclick = () => div.remove()
  return div
}

weightsToUse.forEach(w => el.overridesList.appendChild(createOverrideItem(w)))
el.addOverrideBtn.onclick = () => el.overridesList.appendChild(createOverrideItem())

el.fontUpload.onchange = ({ target }) => {
  const file = target.files[0]
  if (!file) return
  if (!['.ttf', '.otf', '.ttc', '.otc'].some(ext => file.name.toLowerCase().endsWith(ext))) {
    alert('Unsupported font format!')
    return target.value = ''
  }
  const baseName = getBaseName(file.name)
  el.modName.value = baseName.split(' ').map(w => w[0].toUpperCase() + w.slice(1)).join(' ')
  el.modId.value = cleanId(file.name)
  el.selectedFontName.textContent = file.name
  el.initialUpload.classList.add('hidden')
  el.mainContent.classList.remove('hidden')
}

el.moreOptionsBtn.onclick = () => {
  const isHidden = el.extraFields.classList.toggle('hidden')
  el.moreOptionsBtn.textContent = isHidden ? 'More Options' : 'Less Options'
}

el.generateBtn.onclick = async () => {
  const file = el.fontUpload.files[0]
  if (!file) return
  try {
    showStatus('Generating module...')
    const zip = new JSZip(), id = el.modId.value.trim(), name = el.modName.value.trim(), author = el.modAuthor.value.trim()
    zip.file('module.prop', `id=${id}\nname=${name}\nversion=${el.modVersion.value.trim()}\nversionCode=1\nauthor=${author}\ndescription=${el.modDesc.value.trim()}`)
    
    const fontData = await file.arrayBuffer(), inputs = [...document.querySelectorAll('.override-input')], fontsDir = zip.folder('system/fonts')
    inputs.forEach(i => {
      let t = i.value.trim(); if (!t) return
      fontsDir.file(t.includes('.') ? t : t + '.ttf', fontData)
    })

    zip.file('customize.sh', `ui_print "- Installing ${name}..."\nui_print "- Overriding fonts..."\n\nset_perm_recursive $MODPATH/system 0 0 0755 0644 u:object_r:system_file:s0\nui_print "- Done!"`)
    zip.file('post-fs-data.sh', `#!/system/bin/sh\nMODDIR=\${0%/*}\nfind \$MODDIR/system -name "*.ttf" -o -name "*.otf" | while read f; do t=\$(echo "\$f" | sed "s|\$MODDIR||"); [ -f "\$t" ] && mount -o bind "\$f" "\$t"; done`)

    localStorage.setItem('magisk-font-author', author)
    localStorage.setItem('magisk-font-overrides', JSON.stringify(inputs.map(i => i.value.trim()).filter(Boolean)))

    const blob = await zip.generateAsync({ type: 'blob' })
    const url = URL.createObjectURL(blob), a = document.createElement('a')
    Object.assign(a, { href: url, download: `${id}.zip` }).click()
    URL.revokeObjectURL(url)
    showStatus(`Module generated!`)
  } catch (err) { showStatus(`Error: ${err.message}`, true) }
}
