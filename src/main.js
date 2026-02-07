import './style.css'
import JSZip from 'jszip'

const fontUpload = document.getElementById('font-upload')
const mainContent = document.getElementById('main-content')
const initialUpload = document.getElementById('initial-upload')
const modId = document.getElementById('mod-id')
const modName = document.getElementById('mod-name')
const modAuthor = document.getElementById('mod-author')
const modVersion = document.getElementById('mod-version')
const modDesc = document.getElementById('mod-desc')
const generateBtn = document.getElementById('generate-btn')
const moreOptionsBtn = document.getElementById('more-options-btn')
const extraFields = document.getElementById('extra-fields')
const statusContainer = document.getElementById('status-container')
const statusMessage = document.getElementById('status-message')
const selectedFontName = document.getElementById('selected-font-name')
const overridesList = document.getElementById('overrides-list')
const addOverrideBtn = document.getElementById('add-override-btn')

const defaultWeights = [
  'Roboto-Regular.ttf', 'Roboto-Bold.ttf', 'Roboto-Italic.ttf',
  'Roboto-BoldItalic.ttf', 'Roboto-Medium.ttf', 'Roboto-MediumItalic.ttf',
  'Roboto-Light.ttf', 'Roboto-LightItalic.ttf', 'Roboto-Thin.ttf',
  'Roboto-ThinItalic.ttf', 'RobotoStatic-Regular.ttf', 'Roboto-Variable.ttf'
]

// Load settings from localStorage on startup
const savedAuthor = localStorage.getItem('magisk-font-author')
if (savedAuthor) {
  modAuthor.value = savedAuthor
}

const savedOverrides = localStorage.getItem('magisk-font-overrides')
const weightsToUse = savedOverrides ? JSON.parse(savedOverrides) : defaultWeights

const showStatus = (msg, isError = false) => {
  statusContainer.classList.remove('hidden')
  statusMessage.textContent = msg
  statusMessage.style.color = isError ? '#ff4d4d' : '#4facfe'
}

const cleanId = (name) => {
  return name.toLowerCase()
    .replace(/\.[^/.]+$/, "")
    .replace(/\s+/g, '_')
    .replace(/[^a-z0-9._-]/g, '');
}

const getBaseName = (name) => {
  return name.replace(/\.[^/.]+$/, "").replace(/[_-]/g, ' ');
}

const createOverrideItem = (value = '') => {
  const div = document.createElement('div')
  div.className = 'override-item'
  div.innerHTML = `
    <input type="text" class="override-input" value="${value}" placeholder="e.g. Roboto-Regular.ttf" />
    <button class="remove-btn" title="Remove">&times;</button>
  `
  div.querySelector('.remove-btn').addEventListener('click', () => div.remove())
  return div
}

// Initial fill
weightsToUse.forEach(w => overridesList.appendChild(createOverrideItem(w)))

addOverrideBtn.addEventListener('click', () => {
  overridesList.appendChild(createOverrideItem())
})

fontUpload.addEventListener('change', (e) => {
  const file = e.target.files[0]
  if (!file) return

  const fileName = file.name.toLowerCase()
  const allowedExtensions = ['.ttf', '.otf', '.ttc', '.otc']
  const isValid = allowedExtensions.some(ext => fileName.endsWith(ext))

  if (!isValid) {
    alert('Unsupported font format! Please use .ttf, .otf, .ttc, or .otc')
    fontUpload.value = ''
    return
  }

  const baseName = getBaseName(file.name)
  modName.value = baseName.split(' ').map(w => w.charAt(0).toUpperCase() + w.slice(1)).join(' ')
  modId.value = cleanId(file.name)
  selectedFontName.textContent = file.name

  initialUpload.classList.add('hidden')
  mainContent.classList.remove('hidden')
})

moreOptionsBtn.addEventListener('click', () => {
  extraFields.classList.toggle('hidden')
  moreOptionsBtn.textContent = extraFields.classList.contains('hidden') ? 'More Options' : 'Less Options'
})

generateBtn.addEventListener('click', async () => {
  const file = fontUpload.files[0]
  if (!file) return

  try {
    showStatus('Generating module...')
    const zip = new JSZip()

    const propContent = [
      `id=${modId.value.trim()}`,
      `name=${modName.value.trim()}`,
      `version=${modVersion.value.trim()}`,
      `versionCode=1`,
      `author=${modAuthor.value.trim()}`,
      `description=${modDesc.value.trim()}`
    ].join('\n')
    zip.file('module.prop', propContent)

    const fontData = await file.arrayBuffer()

    const inputs = document.querySelectorAll('.override-input')
    const fontsDir = zip.folder('system/fonts')
    let fileCount = 0

    let customizeContent = `ui_print "- Installing ${modName.value}..."
ui_print "- Overriding fonts in /system/fonts..."\n`

    inputs.forEach(input => {
      let target = input.value.trim()
      if (!target) return
      
      // Auto-append .ttf if extension missing
      if (!target.includes('.')) target += '.ttf'
      
      fontsDir.file(target, fontData)
      fileCount++
    })

    // Add explicit permission setting to customize.sh
    customizeContent += `
ui_print "- Setting permissions..."
set_perm_recursive $MODPATH/system 0 0 0755 0644 u:object_r:system_file:s0
ui_print "- Set up ${fileCount} overrides."
ui_print "- Force-mount script added for A/B compatibility."
ui_print "- Done!"`
    zip.file('customize.sh', customizeContent)

    // Add post-fs-data.sh for "Force Mount" on stubborn devices
    const postFsContent = `#!/system/bin/sh
MODDIR=\${0%/*}
# Force bind-mount fonts to ensure they stick on A/B devices
find \$MODDIR/system -name "*.ttf" -o -name "*.otf" | while read font; do
  # Determine target path by stripping the module directory
  target=\$(echo "\$font" | sed "s|\$MODDIR||")
  [ -f "\$target" ] && mount -o bind "\$font" "\$target"
done
`
    zip.file('post-fs-data.sh', postFsContent)

    // Save settings to localStorage
    localStorage.setItem('magisk-font-author', modAuthor.value.trim())
    const currentOverrides = Array.from(inputs).map(i => i.value.trim()).filter(v => v !== '')
    localStorage.setItem('magisk-font-overrides', JSON.stringify(currentOverrides))

    const blob = await zip.generateAsync({ type: 'blob' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = `${modId.value.trim()}.zip`
    a.click()
    URL.revokeObjectURL(url)

    showStatus(`Module generated with ${count} overrides!`)
  } catch (err) {
    showStatus(`Error: ${err.message}`, true)
  }
})
