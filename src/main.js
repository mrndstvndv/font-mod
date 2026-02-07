import JSZip from 'jszip'

// Utilities
const $ = (selector) => document.querySelector(selector)
const $$ = (selector) => document.querySelectorAll(selector)

// State
const state = {
  file: null,
  fileName: '',
  overrides: [
    'Roboto-Regular.ttf', 'Roboto-Bold.ttf', 'Roboto-Italic.ttf', 'Roboto-BoldItalic.ttf',
    'Roboto-Medium.ttf', 'Roboto-MediumItalic.ttf', 'Roboto-Light.ttf', 'Roboto-LightItalic.ttf',
    'Roboto-Thin.ttf', 'Roboto-ThinItalic.ttf', 'RobotoStatic-Regular.ttf', 'Roboto-Variable.ttf'
  ]
}

// Elements
const els = {
  app: $('#app'),
  uploadZone: $('#upload-zone'),
  fileInput: $('#font-upload'),
  stepUpload: $('#step-upload'),
  stepConfig: $('#step-config'),
  selectedFilename: $('#selected-filename'),
  resetUploadBtn: $('#reset-upload'),
  
  modName: $('#mod-name'),
  modAuthor: $('#mod-author'),
  modId: $('#mod-id'),
  modVersion: $('#mod-version'),
  modDesc: $('#mod-desc'),
  
  overridesList: $('#overrides-list'),
  addOverrideBtn: $('#add-override-btn'),
  generateBtn: $('#generate-btn'),
  toast: $('#toast'),
  themeToggle: $('#theme-toggle')
}

// Theme Logic
const setTheme = (theme) => {
  document.documentElement.setAttribute('data-theme', theme)
  localStorage.setItem('theme', theme)
  
  const moonIcon = els.themeToggle.querySelector('.moon-icon')
  const sunIcon = els.themeToggle.querySelector('.sun-icon')
  
  if (theme === 'dark') {
    moonIcon.style.display = 'none'
    sunIcon.style.display = 'block'
  } else {
    moonIcon.style.display = 'block'
    sunIcon.style.display = 'none'
  }
}

const syncThemeIcons = () => {
  const currentTheme = document.documentElement.getAttribute('data-theme') || 'light'
  const moonIcon = els.themeToggle.querySelector('.moon-icon')
  const sunIcon = els.themeToggle.querySelector('.sun-icon')
  
  if (currentTheme === 'dark') {
    moonIcon.style.display = 'none'
    sunIcon.style.display = 'block'
  } else {
    moonIcon.style.display = 'block'
    sunIcon.style.display = 'none'
  }
}

  // Initialization
  const init = () => {
    // Theme
    const savedTheme = localStorage.getItem('theme')
    if (savedTheme === 'dark' || savedTheme === 'light') {
      setTheme(savedTheme)
    } else {
      syncThemeIcons()
    }
    // Restore saved values
    els.modAuthor.value = localStorage.getItem('magisk-font-author') || ''
    const savedOverrides = JSON.parse(localStorage.getItem('magisk-font-overrides') || 'null')
    if (savedOverrides) state.overrides = savedOverrides
    
    renderOverrides()
    setupEventListeners()
    
    // Explicitly set initial state
    switchStep('upload')
  }

// Event Listeners
const setupEventListeners = () => {
  // Global Drag Prevention
  window.addEventListener('dragover', (e) => e.preventDefault())
  window.addEventListener('drop', (e) => e.preventDefault())

  // Drag & Drop
  els.uploadZone.addEventListener('dragover', (e) => {
    e.preventDefault()
    e.stopPropagation()
    els.uploadZone.classList.add('drag-over')
  })

  els.uploadZone.addEventListener('dragleave', (e) => {
    e.preventDefault()
    e.stopPropagation()
    els.uploadZone.classList.remove('drag-over')
  })

  els.uploadZone.addEventListener('drop', (e) => {
    e.preventDefault()
    e.stopPropagation()
    els.uploadZone.classList.remove('drag-over')
    const file = e.dataTransfer.files[0]
    handleFile(file)
  })

  els.fileInput.addEventListener('change', (e) => {
    handleFile(e.target.files[0])
  })

  // Reset
  els.resetUploadBtn.addEventListener('click', () => {
    state.file = null
    els.fileInput.value = ''
    switchStep('upload')
  })

  // Overrides
  els.addOverrideBtn.addEventListener('click', () => {
    state.overrides.unshift('')
    renderOverrides()
  })

  // Generate
  els.generateBtn.addEventListener('click', generateModule)

  // Theme Toggle
  els.themeToggle.addEventListener('click', () => {
    const current = document.documentElement.getAttribute('data-theme') || 'light'
    setTheme(current === 'dark' ? 'light' : 'dark')
  })
}

// Logic
const handleFile = (file) => {
  if (!file) return
  
  const ext = file.name.split('.').pop().toLowerCase()
  if (!['ttf', 'otf', 'ttc', 'otc'].includes(ext)) {
    showToast('Unsupported file format. Please use TTF, OTF, TTC, or OTC.', 'error')
    return
  }

  state.file = file
  state.fileName = file.name
  
  // Auto-fill form
  const baseName = file.name.replace(/\.[^/.]+$/, "") // remove extension
  els.selectedFilename.textContent = file.name
  els.modName.value = formatName(baseName)
  els.modId.value = formatId(baseName)
  
  switchStep('config')
}

  const switchStep = (step) => {
    if (step === 'upload') {
      els.stepConfig.classList.remove('active')
      els.stepConfig.style.display = 'none'

      els.stepUpload.style.display = 'flex'
      requestAnimationFrame(() => els.stepUpload.classList.add('active'))
    } else {
      els.stepUpload.classList.remove('active')
      els.stepUpload.style.display = 'none'

      els.stepConfig.style.display = 'block'
      requestAnimationFrame(() => els.stepConfig.classList.add('active'))
    }
  }

const formatName = (str) => {
  return str.split(/[-_]/).map(word => word.charAt(0).toUpperCase() + word.slice(1)).join(' ')
}

const formatId = (str) => {
  return str.toLowerCase().replace(/[^a-z0-9._-]/g, '_')
}

const renderOverrides = () => {
  els.overridesList.innerHTML = ''
  state.overrides.forEach((override, index) => {
    const div = document.createElement('div')
    div.className = 'override-item'
    
    const input = document.createElement('input')
    input.type = 'text'
    input.value = override
    input.placeholder = 'e.g. Roboto-Regular.ttf'
    input.addEventListener('input', (e) => {
      state.overrides[index] = e.target.value
    })

    const removeBtn = document.createElement('button')
    removeBtn.className = 'remove-btn'
    removeBtn.innerHTML = '&times;'
    removeBtn.title = 'Remove'
    removeBtn.addEventListener('click', () => {
      state.overrides.splice(index, 1)
      renderOverrides()
    })

    div.appendChild(input)
    div.appendChild(removeBtn)
    els.overridesList.appendChild(div)
  })
}

const showToast = (message, type = 'success') => {
  els.toast.textContent = message
  els.toast.className = `toast show ${type}`
  
  setTimeout(() => {
    els.toast.className = 'toast'
  }, 3000)
}

const generateModule = async () => {
  if (!state.file) return

  const modName = els.modName.value.trim() || 'Custom Font'
  const modId = els.modId.value.trim() || 'custom_font'
  const modAuthor = els.modAuthor.value.trim() || 'Unknown'
  const modVersion = els.modVersion.value.trim() || 'v1.0'
  const modDesc = els.modDesc.value.trim() || 'Custom font module'
  
  // Filter empty overrides
  const cleanOverrides = state.overrides.map(s => s.trim()).filter(Boolean)
  if (cleanOverrides.length === 0) {
    showToast('Please add at least one system font to replace.', 'error')
    return
  }

  els.generateBtn.disabled = true
  els.generateBtn.textContent = 'Generating...'

  try {
    const zip = new JSZip()
    
    // module.prop
    zip.file('module.prop', `id=${modId}
name=${modName}
version=${modVersion}
versionCode=1
author=${modAuthor}
description=${modDesc}`)

    // system/fonts
    const fontsDir = zip.folder('system/fonts')
    const fontData = await state.file.arrayBuffer()
    
    cleanOverrides.forEach(filename => {
      // Ensure extension
      const finalName = filename.includes('.') ? filename : `${filename}.ttf`
      fontsDir.file(finalName, fontData)
    })

    // scripts
    zip.file('customize.sh', `ui_print "- Installing ${modName}..."
ui_print "- Overriding fonts..."

set_perm_recursive $MODPATH/system 0 0 0755 0644 u:object_r:system_file:s0
ui_print "- Done!"`)

    zip.file('post-fs-data.sh', `#!/system/bin/sh
MODDIR=\${0%/*}
find $MODDIR/system -name "*.ttf" -o -name "*.otf" | while read f; do
  t=$(echo "$f" | sed "s|$MODDIR||")
  [ -f "$t" ] && mount -o bind "$f" "$t"
done`)

    // Save preferences
    localStorage.setItem('magisk-font-author', modAuthor)
    localStorage.setItem('magisk-font-overrides', JSON.stringify(cleanOverrides))

    // Generate zip
    const content = await zip.generateAsync({ type: 'blob' })
    const url = URL.createObjectURL(content)
    const a = document.createElement('a')
    a.href = url
    a.download = `${modId}.zip`
    a.click()
    URL.revokeObjectURL(url)

  } catch (err) {
    console.error(err)
    showToast('Failed to generate module.', 'error')
  } finally {
    els.generateBtn.disabled = false
    els.generateBtn.innerHTML = `<span>Generate Module</span><svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/></svg>`
  }
}

// Start
init()
