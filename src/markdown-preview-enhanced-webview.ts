// markdown-preview-enhanced-view controller
(function() {

console.log('init webview')
// const settings = JSON.parse(document.getElementById('vscode-markdown-preview-enhanced-data').getAttribute('data-settings'));
// console.log(settings)

// copied from 'config.ts'
interface MarkdownConfig {
  breakOnSingleNewLine?: boolean,
  enableTypographer?: boolean,
  scrollSync?: boolean,
  mermaidTheme?: string,

  mathRenderingOption?: string,
  mathInlineDelimiters?: Array<string[]>,
  mathBlockDelimiters?: Array<string[]>,

  codeBlockTheme?: string,

  previewTheme?: string,

  imageFolderPath?: string,
  imageUploader?: string
}

/**
 * .mpe-toolbar {
 *   .refresh-btn
 *   .back-to-top-btn
 *   .sidebar-toc-btn
 * }
 */
interface Toolbar {
  toolbar: HTMLElement,
  backToTopBtn: HTMLElement,
  refreshBtn: HTMLElement,
  sidebarTOCBtn: HTMLElement
}

interface MarkdownPreviewEnhancedPreview {
 /**
   * whether finished loading preview
   */
  doneLoadingPreview: boolean

 /**
  * .markdown-preview-enhanced-container element 
  */
  containerElement: HTMLElement,

 /**
  * this is the element with class `markdown-preview-enhanced`
  * the final html is rendered by that previewElement
  */
  previewElement: HTMLElement,

  /**
   * .markdown-preview-enhanced.hidden-preview element
   * hiddenPreviewElement is used to render html and then put the rendered html result to previewElement
   */
  hiddenPreviewElement: HTMLElement,

  /**
   * Toolbar object
   */
  toolbar: Toolbar,

  /**
   * whether to enable sidebar toc
   */
  enableSidebarTOC: boolean

  /**
   * .sidebar-toc element
   */
  sidebarTOC:HTMLElement

  /**
   * .sidebar-toc element innerHTML generated by markdown-engine.ts
   */
  sidebarTOCHTML:string

  /**
   * zoom level
   */
  zoomLevel:number

  /**
   * .refreshing-icon element
   */
  refreshingIcon:HTMLElement
  refreshingIconTimeout

  /**
   * scroll map 
   */
  scrollMap: Array<number>

  /**
   * TextEditor total buffer line count
   */
  totalLineCount: number

  /**
   * TextEditor cursor current line position
   */
  currentLine: number


  previewScrollDelay: number 
  editorScrollDelay: number

  /**
   * whether enter presentation mode
   */ 
  presentationMode: boolean

  /**
   * zoom of the presentation
   */
  presentationZoom: number

  /**
   * track the buffer line number of slides
   */
  slideBufferLineNumbers: Array<number>

  /**
   * setTimeout value
   */
  scrollTimeout: any

}

let $:JQuery = null

/**
 * This config is the same as the one defined in `config.ts` file
 */
let config:MarkdownConfig = {}

/**
 * markdown file URI 
 */
let sourceUri = null

/**
 * mpe URI
 */
let previewUri = null 

/**
 * mpe object 
 */
let mpe: MarkdownPreviewEnhancedPreview = null

function onLoad() {
  $ = window['$'] as JQuery

  /** init preview elements */
  const previewElement = document.getElementsByClassName('markdown-preview-enhanced')[0] as HTMLElement
  const hiddenPreviewElement = document.createElement("div")
  hiddenPreviewElement.classList.add('markdown-preview-enhanced')
  hiddenPreviewElement.classList.add('hidden-preview')
  hiddenPreviewElement.setAttribute('for', 'preview')
  hiddenPreviewElement.style.zIndex = '0'
  previewElement.insertAdjacentElement('beforebegin', hiddenPreviewElement)

  /** init contextmenu */
  initContextMenu()

  /** load config */
  config = JSON.parse(document.getElementById('vscode-markdown-preview-enhanced-data').getAttribute('data-config'))
  sourceUri = config['sourceUri']
  previewUri = config['previewUri']

  // console.log(document.getElementsByTagName('html')[0].innerHTML)
  // console.log(JSON.stringify(config))

  /** init mpe object */
  mpe = {
    doneLoadingPreview: false,
    containerElement: document.body,
    previewElement,
    hiddenPreviewElement,
    currentLine: config['line'] || -1,
    scrollMap: null,
    previewScrollDelay: 0,
    editorScrollDelay: 0,
    totalLineCount: 0,
    scrollTimeout: null,
    presentationZoom: 1,
    presentationMode: false,
    slideBufferLineNumbers: [],
    toolbar: {
      toolbar: document.getElementsByClassName('mpe-toolbar')[0] as HTMLElement,
      backToTopBtn: document.getElementsByClassName('back-to-top-btn')[0] as HTMLElement,
      refreshBtn: document.getElementsByClassName('refresh-btn')[0] as HTMLElement,
      sidebarTOCBtn: document.getElementsByClassName('sidebar-toc-btn')[0] as HTMLElement
    },
    enableSidebarTOC: false,
    sidebarTOC: null,
    sidebarTOCHTML: "",
    zoomLevel: 1,
    refreshingIcon: document.getElementsByClassName('refreshing-icon')[0] as HTMLElement, 
    refreshingIconTimeout: null
  }

  /** init mermaid */
  initMermaid()

  /** init toolbar event */
  initToolbarEvent()

  /** init image helper */
  initImageHelper()

  previewElement.onscroll = scrollEvent

  window.parent.postMessage({ 
    command: 'did-click-link', // <= this has to be `did-click-link` to post message
    data: `command:_markdown-preview-enhanced.webviewFinishLoading?${JSON.stringify([sourceUri])}`
  }, 'file://')
}

/**
 * init events for tool bar
 */
function initToolbarEvent() {    
    const toolbarElement = mpe.toolbar.toolbar
    const showToolbar = ()=> toolbarElement.style.opacity = "1"
    mpe.previewElement.onmouseenter = showToolbar
    mpe.toolbar.toolbar.onmouseenter = showToolbar
    mpe.previewElement.onmouseleave = ()=> toolbarElement.style.opacity = "0"

    initSideBarTOCButton()
    initBackToTopButton()
    initRefreshButton()

    return toolbar
}

/**
 * init .sidebar-toc-btn
 */
function initSideBarTOCButton() {

  mpe.toolbar.sidebarTOCBtn.onclick = ()=> {
    mpe.enableSidebarTOC = !mpe.enableSidebarTOC

    if (mpe.enableSidebarTOC) {
      mpe.sidebarTOC = document.createElement('div') // create new sidebar toc
      mpe.sidebarTOC.classList.add('mpe-sidebar-toc')
      mpe.containerElement.appendChild(mpe.sidebarTOC)
      mpe.containerElement.classList.add('show-sidebar-toc')
      renderSidebarTOC()
      setZoomLevel()
    } else {
      if (mpe.sidebarTOC) mpe.sidebarTOC.remove()
      mpe.sidebarTOC = null
      mpe.containerElement.classList.remove('show-sidebar-toc')
      mpe.previewElement.style.width = "100%"
    }

    mpe.scrollMap = null 
  }
}

/**
 * init .back-to-top-btn
 */
function initBackToTopButton() {
  mpe.toolbar.backToTopBtn.onclick = ()=> {
    mpe.previewElement.scrollTop = 0
  }
}

/**
 * init .refresh-btn
 */
function initRefreshButton() {
  mpe.toolbar.refreshBtn.onclick = ()=> {
    window.parent.postMessage({ command: 'did-click-link', data: `command:_markdown-preview-enhanced.refreshPreview?${JSON.stringify([sourceUri])}`}, 'file://') 
  }
}

/**
 * init contextmenu
 * check markdown-preview-enhanced-view.ts
 * reference: http://jsfiddle.net/w33z4bo0/1/
 */
function initContextMenu() {
  $["contextMenu"]({
    selector: '.markdown-preview-enhanced-container',
    items: {
      "open_in_browser": {
        name: "Open in Browser", 
        callback: ()=>{     
          window.parent.postMessage({ command: 'did-click-link', data: `command:_markdown-preview-enhanced.openInBrowser?${JSON.stringify([sourceUri])}`}, 'file://') 
        } 
      },
      "sep1": "---------",
      "html_export": {
        name: "HTML",
        callback: ()=> {
          window.parent.postMessage({ command: 'did-click-link', data: `command:_markdown-preview-enhanced.saveAsHTML?${JSON.stringify([sourceUri])}`}, 'file://') 
        }
      },
      "prince_export": 
      {
        name: "PDF (prince)",
        callback: ()=> {
          window.parent.postMessage({ command: 'did-click-link', data: `command:_markdown-preview-enhanced.princeExport?${JSON.stringify([sourceUri])}`}, 'file://') 
        }
      },
      "ebook_export": {
        name: "eBook",
        items: {
          "ebook_epub": {
            name: "ePub",
            callback: ()=> {
              window.parent.postMessage({ command: 'did-click-link', data: `command:_markdown-preview-enhanced.eBookExport?${JSON.stringify([sourceUri, 'epub'])}`}, 'file://') 
            }
          },
          "ebook_mobi": {
            name: "mobi",
            callback: ()=> {
              window.parent.postMessage({ command: 'did-click-link', data: `command:_markdown-preview-enhanced.eBookExport?${JSON.stringify([sourceUri, 'mobi'])}`}, 'file://') 
            }
          },
          "ebook_pdf": {
            name: "PDF",
            callback: ()=> {
              window.parent.postMessage({ command: 'did-click-link', data: `command:_markdown-preview-enhanced.eBookExport?${JSON.stringify([sourceUri, 'pdf'])}`}, 'file://') 
            }
          },
          "ebook_html": {
            name: "HTML",
            callback: ()=> {
              window.parent.postMessage({ command: 'did-click-link', data: `command:_markdown-preview-enhanced.eBookExport?${JSON.stringify([sourceUri, 'html'])}`}, 'file://') 
            }
          }
        }
      },
      "pandoc_export": {name: "Pandoc (not done)"},
      "save_as_markdown": {name: "Save as Markdown (not done)"},
      "sep2": "---------",
      "sync_source": {name: "Sync Source (not done)"}
    }
  })
}

/**
 * init image helper
 */
function initImageHelper() {
  const imageHelper = document.getElementById("image-helper-view")

  // url editor
  // used to insert image url
  const urlEditor = imageHelper.getElementsByClassName('url-editor')[0] as HTMLInputElement
  urlEditor.addEventListener('keypress', (event:KeyboardEvent)=> {
    if (event.keyCode === 13) { // enter key pressed 
      let url = urlEditor.value.trim()
      if (url.indexOf(' ') >= 0) {
        url = `<${url}>`
      }
      if (url.length) {
        $['modal'].close() // close modal
        window.parent.postMessage({ command: 'did-click-link', data: `command:_markdown-preview-enhanced.insertImageUrl?${JSON.stringify([sourceUri, url])}`}, 'file://') 
      }
      return false 
    } else {
      return true 
    }
  })

  const copyLabel = imageHelper.getElementsByClassName('copy-label')[0] as HTMLLabelElement
  copyLabel.innerText = `Copy image to ${config.imageFolderPath[0] == '/' ? 'root' : 'relative'} ${config.imageFolderPath} folder`

  const imageUploaderSelect = imageHelper.getElementsByClassName('uploader-select')[0] as HTMLSelectElement
  imageUploaderSelect.value = config.imageUploader

  // drop area has 2 events:
  // 1. paste(copy) image to imageFolderPath
  // 2. upload image
  const dropArea = window['$']('.drop-area', imageHelper)
  const fileUploader = window['$']('.file-uploader', imageHelper)
  dropArea.on('drop dragend dragstart dragenter dragleave drag dragover', (e)=> {
    e.preventDefault()
    e.stopPropagation()
    if (e.type == "drop") {
      if (e.target.className.indexOf('paster') >= 0) { // paste
        const files = e.originalEvent.dataTransfer.files
        for (let i = 0; i < files.length; i++) {
          const file = files[i]
          window.parent.postMessage({ command: 'did-click-link', data: `command:_markdown-preview-enhanced.pasteImageFile?${JSON.stringify([sourceUri, file.path])}`}, 'file://') 
        }
      } else { // upload
        const files = e.originalEvent.dataTransfer.files
        for (let i = 0; i < files.length; i++) {
          const file = files[i]
          window.parent.postMessage({ command: 'did-click-link', data: `command:_markdown-preview-enhanced.uploadImageFile?${JSON.stringify([sourceUri, file.path, imageUploaderSelect.value])}`}, 'file://') 
        }
      }
      $['modal'].close() // close modal
    }
  })
  dropArea.on('click', function(e) {
      e.preventDefault()
      e.stopPropagation()
      window['$'](this).find('input[type="file"]').click()
      $['modal'].close() // close modal
  })
  fileUploader.on('click', (e)=>{
    e.stopPropagation()
  })
  fileUploader.on('change', (e)=> {
    if (e.target.className.indexOf('paster') >= 0) { // paste
      const files = e.target.files
      for (let i = 0; i < files.length; i++) {
        const file = files[i]
        window.parent.postMessage({ command: 'did-click-link', data: `command:_markdown-preview-enhanced.pasteImageFile?${JSON.stringify([sourceUri, file.path])}`}, 'file://') 
      }
      fileUploader.val('')
    } else { // upload
      const files = e.target.files
      for (let i = 0; i < files.length; i++) {
        const file = files[i]
        window.parent.postMessage({ command: 'did-click-link', data: `command:_markdown-preview-enhanced.uploadImageFile?${JSON.stringify([sourceUri, file.path, imageUploaderSelect.value])}`}, 'file://') 
      }
      fileUploader.val('')
    }
  })

}

/**
 * init mermaid
 */
function initMermaid() {
  const mermaidAPI = window["mermaidAPI"]
  // mermaidAPI.initialize(loadMermaidConfig())
  mermaidAPI.initialize({startOnLoad: false})
}

/**
 * render mermaid graphs
 */
function renderMermaid() {
  return new Promise((resolve, reject)=> {
    const mermaid = window['mermaid'] // window.mermaid doesn't work, has to be written as window['mermaid']
    const mermaidAPI = window['mermaidAPI']
    const mermaidGraphs = mpe.hiddenPreviewElement.getElementsByClassName('mermaid')

    const validMermaidGraphs = []
    const mermaidCodes = []
    for (let i = 0; i < mermaidGraphs.length; i++) {
      const mermaidGraph = mermaidGraphs[i] as HTMLElement
      if (mermaidGraph.getAttribute('data-processed') === 'true') continue 

      mermaid.parseError = function(err) {
        mermaidGraph.innerHTML = `<pre class="language-text">${err.toString()}</pre>`
      }

      if (mermaidAPI.parse(mermaidGraph.textContent)) {
        validMermaidGraphs.push(mermaidGraph)
        mermaidCodes.push(mermaidGraph.textContent)
      }
    }

    if (!validMermaidGraphs.length) return resolve()

    mermaid.init(null, validMermaidGraphs, function(){
      resolve()

      // send svg data
      const CryptoJS = window["CryptoJS"]
      validMermaidGraphs.forEach((mermaidGraph, offset)=> {
        const code = mermaidCodes[offset],
              svg = CryptoJS.AES.encrypt(mermaidGraph.outerHTML, "markdown-preview-enhanced").toString()

        window.parent.postMessage({ 
          command: 'did-click-link', // <= this has to be `did-click-link` to post message
          data: `command:_markdown-preview-enhanced.cacheSVG?${JSON.stringify([sourceUri, code, svg])}`
        }, 'file://')
      })
    })
  })
}

/**
 * render MathJax expressions
 */
function renderMathJax() {
  return new Promise((resolve, reject)=> {
    if (config['mathRenderingOption'] === 'MathJax') {
      const MathJax = window['MathJax']
      const unprocessedElements = mpe.hiddenPreviewElement.getElementsByClassName('mathjax-exps')
      if (!unprocessedElements.length) return resolve()

      window['MathJax'].Hub.Queue(
        ['Typeset', MathJax.Hub, mpe.hiddenPreviewElement], 
        [function() {
          // sometimes the this callback will be called twice
          // and only the second time will the Math expressions be rendered.
          // therefore, I added the line below to check whether math is already rendered.  
          if (!mpe.hiddenPreviewElement.getElementsByClassName('MathJax').length) return
          
          mpe.scrollMap = null
          return resolve()
        }])
    } else {
      return resolve()
    }
  })
}

function runCodeChunk(id:string) {
  const codeChunk = document.querySelector(`.code-chunk[data-id="${id}"]`)
  const running = codeChunk.classList.contains('running')
  if (running) return 
  codeChunk.classList.add('running')

  window.parent.postMessage({ 
    command: 'did-click-link', // <= this has to be `did-click-link` to post message
    data: `command:_markdown-preview-enhanced.runCodeChunk?${JSON.stringify([sourceUri, id])}`
  }, 'file://')
}

function runAllCodeChunks() {
  const codeChunks = mpe.previewElement.getElementsByClassName('code-chunk')
  for (let i = 0; i < codeChunks.length; i++) {
    codeChunks[i].classList.add('running')
  }

  window.parent.postMessage({ 
    command: 'did-click-link', // <= this has to be `did-click-link` to post message
    data: `command:_markdown-preview-enhanced.runAllCodeChunks?${JSON.stringify([sourceUri])}`
  }, 'file://')
}

function runNearestCodeChunk() {
  const currentLine = mpe.currentLine
  const elements = mpe.previewElement.children
  for (let i = elements.length - 1; i >= 0; i--) {
    if (elements[i].classList.contains('sync-line') && elements[i + 1] && elements[i + 1].classList.contains('code-chunk')) {
      if (currentLine >= parseInt(elements[i].getAttribute('data-line'))) {
        const codeChunkId = elements[i + 1].getAttribute('data-id')
        return runCodeChunk(codeChunkId)
      }
    }
  }
}

/**
 * Setup code chunks
 */
function setupCodeChunks() {
  const codeChunks = mpe.previewElement.getElementsByClassName('code-chunk')
  if (!codeChunks.length) return 

  let needToSetupCodeChunkId = false 

  for (let i = 0; i < codeChunks.length; i++) {
    const codeChunk = codeChunks[i],
          id = codeChunk.getAttribute('data-id')

    // bind click event 
    const runBtn = codeChunk.getElementsByClassName('run-btn')[0]
    const runAllBtn = codeChunk.getElementsByClassName('run-all-btn')[0]
    if (runBtn) {
      runBtn.addEventListener('click', ()=> {
        runCodeChunk(id)
      })
    }
    if (runAllBtn) {
      runAllBtn.addEventListener('click', ()=> {
        runAllCodeChunks()
      })
    }
  }
}

/**
 * render sidebar toc 
 */
function renderSidebarTOC() {
  if (!mpe.enableSidebarTOC) return
  if (mpe.sidebarTOCHTML) {
    mpe.sidebarTOC.innerHTML = mpe.sidebarTOCHTML
  } else {
    mpe.sidebarTOC.innerHTML = `<p style="text-align:center;font-style: italic;">Outline (empty)</p>`
  }
}

/**
 * zoom slides to fit screen
 */
function zoomSlidesToFitScreen(element:HTMLElement) {
  const width = parseFloat(element.getAttribute('data-width')),
        height = parseFloat(element.getAttribute('data-height'))
  
  // ratio = height / width * 100 + '%'
  const desiredWidth = mpe.previewElement.offsetWidth - 200
  const zoom = desiredWidth / width  // 100 is padding
  
  mpe.slideBufferLineNumbers = []

  const slides = element.getElementsByClassName('slide') 
  for (let i = 0; i < slides.length; i++) {
    const slide = slides[i] as HTMLElement
    slide.style.zoom = zoom.toString()

    mpe.slideBufferLineNumbers.push(parseInt(slide.getAttribute('data-line')))
  }
  mpe.presentationZoom = zoom
}

/**
 * init several preview events
 */
async function initEvents() {
  await Promise.all([
    renderMathJax(), 
    renderMermaid()
  ])
  mpe.previewElement.innerHTML = mpe.hiddenPreviewElement.innerHTML
  mpe.hiddenPreviewElement.innerHTML = ""

  setupCodeChunks()

  if (mpe.refreshingIconTimeout) {
    clearTimeout(mpe.refreshingIconTimeout)
    mpe.refreshingIconTimeout = null
  }
  mpe.refreshingIcon.style.display = "none"
}

/**
 * update previewElement innerHTML content
 * @param html 
 */
function updateHTML(html) {
  // editorScrollDelay = Date.now() + 500
  mpe.previewScrollDelay = Date.now() + 500

  mpe.hiddenPreviewElement.innerHTML = html

  let previewSlidesElement;
  if ( previewSlidesElement = mpe.hiddenPreviewElement.querySelector('#preview-slides')) {
    mpe.previewElement.setAttribute('data-presentation-preview-mode', '')
    mpe.hiddenPreviewElement.setAttribute('data-presentation-preview-mode', '')

    mpe.presentationMode = true 
    zoomSlidesToFitScreen(previewSlidesElement)
  } else {
    mpe.previewElement.removeAttribute('data-presentation-preview-mode')
    mpe.hiddenPreviewElement.removeAttribute('data-presentation-preview-mode')

    mpe.presentationMode = false 
  }

  const scrollTop = mpe.previewElement.scrollTop
  // init several events 
  initEvents().then(()=> {
    mpe.scrollMap = null 
    
    // scroll to initial position 
    if (!mpe.doneLoadingPreview) {
      mpe.doneLoadingPreview = true
      scrollToRevealSourceLine(config['initialLine'])
    } else { // restore scrollTop
      mpe.previewElement.scrollTop = scrollTop // <= This line is necessary...
    }
  })
}

/**
 * Build offsets for each line (lines can be wrapped)
 * That's a bit dirty to process each line everytime, but ok for demo.
 * Optimizations are required only for big texts.
 * @return array
 */
function buildScrollMap():Array<number> {
  if (!mpe.totalLineCount) return null
  const _scrollMap = [],
        nonEmptyList = []
  
  for (let i = 0; i < mpe.totalLineCount; i++) {
    _scrollMap.push(-1)
  }

  nonEmptyList.push(0)
  _scrollMap[0] = 0

  // write down the offsetTop of element that has 'data-line' property to _scrollMap
  const lineElements = mpe.previewElement.getElementsByClassName('sync-line')

  for (let i = 0; i < lineElements.length; i++) {
    let el = lineElements[i] as HTMLElement
    let t:any = el.getAttribute('data-line')
    if (!t) continue

    t = parseInt(t)
    if(!t) continue

    // this is for ignoring footnote scroll match
    if (t < nonEmptyList[nonEmptyList.length - 1])
      el.removeAttribute('data-line')
    else {
      nonEmptyList.push(t)

      let offsetTop = 0
      while (el && el !== mpe.previewElement) {
        offsetTop += el.offsetTop
        el = el.offsetParent as HTMLElement
      }

      _scrollMap[t] = Math.round(offsetTop)
    }
  }

  nonEmptyList.push(mpe.totalLineCount)
  _scrollMap.push(mpe.previewElement.scrollHeight)

  let pos = 0
  for (let i = 0; i < mpe.totalLineCount; i++) {
    if (_scrollMap[i] !== -1) {
      pos++
      continue
    }

    let a = nonEmptyList[pos - 1]
    let b = nonEmptyList[pos]
    _scrollMap[i] = Math.round((_scrollMap[b] * (i - a) + _scrollMap[a] * (b - i)) / (b - a))
  }

  return _scrollMap  // scrollMap's length == screenLineCount (vscode can't get screenLineCount... sad)
}

function scrollEvent() { 
  if (!config.scrollSync) return

  if (!mpe.scrollMap) {
    mpe.scrollMap = buildScrollMap()
    return 
  }

  if ( Date.now() < mpe.previewScrollDelay ) return 
  previewSyncSource()
}

function previewSyncSource() {
  let scrollToLine

  if (mpe.previewElement.scrollTop === 0) {
    // editorScrollDelay = Date.now() + 100
    scrollToLine = 0

    window.parent.postMessage({ 
      command: 'did-click-link', // <= this has to be `did-click-link` to post message
      data: `command:_markdown-preview-enhanced.revealLine?${JSON.stringify([sourceUri, scrollToLine])}`
    }, 'file://')

    return 
  }

  let top = mpe.previewElement.scrollTop + mpe.previewElement.offsetHeight / 2

  if (mpe.presentationMode) {
    top = top / mpe.presentationZoom
  }

  // try to find corresponding screen buffer row
  if (!mpe.scrollMap) mpe.scrollMap = buildScrollMap()

  let i = 0
  let j = mpe.scrollMap.length - 1
  let count = 0
  let screenRow = -1 // the screenRow is the bufferRow in vscode.
  let mid 

  while (count < 20) {
    if (Math.abs(top - mpe.scrollMap[i]) < 20) {
      screenRow = i
      break
    } else if (Math.abs(top - mpe.scrollMap[j]) < 20) {
      screenRow = j
      break
    } else {
      mid = Math.floor((i + j) / 2)
      if (top > mpe.scrollMap[mid])
        i = mid
      else
        j = mid
    }
    count++
  }

  if (screenRow == -1)
    screenRow = mid

  scrollToLine = screenRow
  // console.log(scrollToLine)

  window.parent.postMessage({ 
    command: 'did-click-link', // <= this has to be `did-click-link` to post message
    data: `command:_markdown-preview-enhanced.revealLine?${JSON.stringify([sourceUri, scrollToLine])}`
  }, 'file://')

  // @scrollToPos(screenRow * @editor.getLineHeightInPixels() - @previewElement.offsetHeight / 2, @editor.getElement())
  // # @editor.getElement().setScrollTop

  // track currnet time to disable onDidChangeScrollTop
  // editorScrollDelay = Date.now() + 100
}

function setZoomLevel () {
  mpe.previewElement.style.zoom = mpe.zoomLevel.toString()
  if (mpe.enableSidebarTOC) {
    mpe.previewElement.style.width = `calc(100% - ${268 / mpe.zoomLevel}px)`
  }
  mpe.scrollMap = null
}

/**
 * scroll sync to display slide according `line`
 * @param: line: the buffer row of editor
 */
function scrollSyncToSlide(line:number) {
  let i = mpe.slideBufferLineNumbers.length - 1 
  while (i >= 0) {
    if (line >= mpe.slideBufferLineNumbers[i]) {
      break
    }
    i -= 1
  }
  
  const slideElement:HTMLElement = mpe.previewElement.querySelector(`.slide[data-offset="${i}"]`) as HTMLElement
  if (!slideElement) {
    mpe.previewElement.scrollTop = 0
  } else {
    const firstSlide = mpe.previewElement.querySelector('.slide[data-offset="0"]') as HTMLElement
    // set slide to middle of preview
    mpe.previewElement.scrollTop = -mpe.previewElement.offsetHeight/2 + (slideElement.offsetTop + slideElement.offsetHeight/2)*mpe.presentationZoom

  }  
}

/**
 * scroll preview to match `line`
 * @param line: the buffer row of editor
 */
function scrollSyncToLine(line:number) {
  if (!mpe.scrollMap) mpe.scrollMap = buildScrollMap()

  /**
   * Since I am not able to access the viewport of the editor 
   * I used `golden section` here for scrollTop.  
   */
  scrollToPos(Math.max(mpe.scrollMap[line] - mpe.previewElement.offsetHeight * 0.372, 0))
}

/**
 * Smoothly scroll the previewElement to `scrollTop` position.  
 * @param scrollTop: the scrollTop position that the previewElement should be at
 */
function scrollToPos(scrollTop) {
  if (mpe.scrollTimeout) {
    clearTimeout(mpe.scrollTimeout)
    mpe.scrollTimeout = null
  }

  if (scrollTop < 0) return 

  const delay = 10

  function helper(duration=0) {
    mpe.scrollTimeout = setTimeout(() => {
      if (duration <= 0) {
        mpe.previewScrollDelay = Date.now() + 500
        mpe.previewElement.scrollTop = scrollTop
        return
      }

      const difference = scrollTop - mpe.previewElement.scrollTop

      const perTick = difference / duration * delay

      // disable preview onscroll
      mpe.previewScrollDelay = Date.now() + 500

      mpe.previewElement.scrollTop += perTick
      if (mpe.previewElement.scrollTop == scrollTop) return 

      helper(duration-delay)
    }, delay)
  }

  const scrollDuration = 120
  helper(scrollDuration)
}

/**
 * It's unfortunate that I am not able to access the viewport.  
 * @param line 
 */
function scrollToRevealSourceLine(line) {
  if (!config.scrollSync || line === mpe.currentLine) {
    return 
  } else {
    mpe.currentLine = line
  }

  // disable preview onscroll
  mpe.previewScrollDelay = Date.now() + 500

  if (mpe.presentationMode) {
    scrollSyncToSlide(line)
  } else {
    scrollSyncToLine(line)
  }
}


function resizeEvent() {
  // console.log('resize')
  mpe.scrollMap = null

  /*
  // nvm it doesn't work.  
  if (this.presentationMode) { // zoom again 
    zoomSlidesToFitScreen(document.getElementById('preview-slides'))
  }
  */
}

window.addEventListener('message', (event)=> {
  const data = event.data 
  if (!data) return 
  
  // console.log('receive message: ' + data.type)

  if (data.type === 'update-html') {
    mpe.totalLineCount = data.totalLineCount
    mpe.sidebarTOCHTML = data.tocHTML
    sourceUri = data.sourceUri
    renderSidebarTOC()
    updateHTML(data.html)
  } else if (data.type === 'change-text-editor-selection') {
    const line = parseInt(data.line)
    scrollToRevealSourceLine(line)
  } else if (data.type === 'start-parsing-markdown') {
    /**
     * show refreshingIcon after 1 second
     * if preview hasn't finished rendering.
     */
    if (mpe.refreshingIconTimeout) clearTimeout(mpe.refreshingIconTimeout)

    mpe.refreshingIconTimeout = setTimeout(()=> {
      mpe.refreshingIcon.style.display = "block"
    }, 1000)
  } else if (data.type === 'open-image-helper') {
    window['$']('#image-helper-view').modal()
  } else if (data.type === 'run-all-code-chunks') {
    runAllCodeChunks()
  } else if (data.type === 'run-code-chunk') {
    runNearestCodeChunk()
  }
}, false);

window.addEventListener('resize', resizeEvent)

/*
window.parent.postMessage({ 
  command: 'did-click-link', // <= this has to be `did-click-link` to post message
  data: `command:_markdown-preview-enhanced.revealLine?${JSON.stringify([settings.fsPath])}`
}, 'file://')
*/

if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', onLoad);
} else {
  onLoad();
}
})()
