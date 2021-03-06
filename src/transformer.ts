// import * as Baby from "babyparse"
import * as path from "path"
import * as fs from "fs"
import * as less from "less"
import * as request from "request"
import * as Baby from "babyparse"

// import * as request from 'request'
// import * as less from "less"
// import * as md5 from "md5"
// import * as temp from "temp"
// temp.track()
import * as utility from "./utility"
const extensionDirectoryPath = utility.getExtensionDirectoryPath()
const jsonic = require(path.resolve(extensionDirectoryPath, './dependencies/jsonic/jsonic.js'))
const md5 = require(path.resolve(extensionDirectoryPath, './dependencies/javascript-md5/md5.js'))

import {CustomSubjects} from "./custom-subjects"

interface TransformMarkdownOutput {
  outputString: string,
  /**
   * An array of slide configs.  
   */
  slideConfigs: Array<object>,
  /**
   * whehter we found [TOC] in markdown file or not.  
   */
  tocBracketEnabled: boolean
}

interface TransformMarkdownOptions {
  fileDirectoryPath: string 
  projectDirectoryPath: string 
  filesCache: {[key:string]: string}
  useRelativeImagePath: boolean
  forPreview: boolean
  protocolsWhiteListRegExp: RegExp
}

const fileExtensionToLanguageMap = {
  'vhd': 'vhdl',
  'erl': 'erlang',
  'dot': 'dot',
  'gv': 'dot',
  'viz': 'dot',
}

/**
 * Convert 2D array to markdown table.
 * The first row is headings.
 */
function _2DArrayToMarkdownTable(_2DArr) {
  let output = "  \n"
  _2DArr.forEach((arr, offset)=> {
    let i = 0
    output += '|'
    while (i < arr.length) {
      output += (arr[i] + '|')
      i += 1
    }
    output += '  \n'
    if (offset === 0) {
      output += '|'
      i = 0
      while (i < arr.length) {
        output += ('---|')
        i += 1
      }
      output += '  \n'
    }
  })

  output += '  '
  return output
}


function createAnchor(lineNo) {
  return `\n\n<p data-line="${lineNo}" class="sync-line" style="margin:0;"></p>\n\n`
}

/**
 * 
 * Load file by `filePath`
 * @param filePath 
 * @param param1 
 * @param filesCache 
 */
async function loadFile(filePath:string, {fileDirectoryPath, forPreview}, filesCache={}):Promise<string> {
  if (filesCache[filePath])
    return filesCache[filePath]

  if (filePath.endsWith('.less')) { // less file
    const data = await utility.readFile(filePath, {encoding: 'utf-8'})
    return await new Promise<string>((resolve, reject)=> {
      less.render(data, {paths: [path.dirname(filePath)]}, (error, output)=> {
        if (error) return reject(error)
        return resolve(output.css || '')
      })
    })
  }
  /*
  else if filePath.endsWith('.pdf') # pdf file
    downloadFileIfNecessary(filePath)
    .then (localFilePath)->
      PDF ?= require('./pdf')
      PDF.toSVGMarkdown localFilePath, {svgDirectoryPath: imageDirectoryPath, markdownDirectoryPath: fileDirectoryPath}, (error, svgMarkdown)->
        if error
          return reject error
        else
          return resolve(svgMarkdown)
  
  else if filePath.endsWith('.js') # javascript file
    requiresJavaScriptFiles(filePath, forPreview).then (jsCode)->
      return resolve(jsCode)
    .catch (e)->
      return resolve(e)
    # .catch (error)->
    #  return reject(error)
  */
  else if (filePath.match(/^https?\:\/\//)) { // online file
    // github
    if (filePath.startsWith('https://github.com/'))
      filePath = filePath.replace('https://github.com/', 'https://raw.githubusercontent.com/').replace('/blob/', '/')

    return await new Promise<string>((resolve, reject)=> {
      request(filePath, (error, response, body)=> {
        if (error)
          reject(error)
        else
          resolve(body.toString())
      })
    })
  }
  else { // local file
    return await utility.readFile(filePath, {encoding: 'utf-8'})
  }
}

/**
 * 
 * @param inputString 
 * @param fileDirectoryPath 
 * @param projectDirectoryPath 
 * @param param3 
 */
export async function transformMarkdown(inputString:string, 
                            { fileDirectoryPath = '', 
                              projectDirectoryPath = '', 
                              filesCache = {}, 
                              useRelativeImagePath = null,
                              forPreview = false,
                              protocolsWhiteListRegExp = null }:TransformMarkdownOptions):Promise<TransformMarkdownOutput> {
    let inBlock = false // inside code block
    const tocConfigs = [],
          slideConfigs = []
    let tocBracketEnabled = false 

    async function helper(i, lineNo=0, outputString=""):Promise<TransformMarkdownOutput> {
      if (i >= inputString.length) { // done 
        return {outputString, slideConfigs, tocBracketEnabled}
      }

      if (inputString[i] == '\n')
        return helper(i+1, lineNo+1, outputString+'\n')

      let end = inputString.indexOf('\n', i)
      if (end < 0) end = inputString.length
      let line = inputString.substring(i, end)

      if (line.match(/^\s*```/)) {
        if (!inBlock && forPreview) outputString += createAnchor(lineNo)
        inBlock = !inBlock
        return helper(end+1, lineNo+1, outputString+line+'\n')
      }

      if (inBlock)
        return helper(end+1, lineNo+1, outputString+line+'\n')

      let subjectMatch

      if (line.match(/^(\#|\!\[|@import)/)) {
        if (forPreview) outputString += createAnchor(lineNo) // insert anchor for scroll sync
      } else if (subjectMatch = line.match(/^\<!--\s+([^\s]+)/)) {
        if (forPreview) outputString += createAnchor(lineNo)
        
        let subject = subjectMatch[1]
        if (subject in CustomSubjects) {
          let commentEnd = inputString.indexOf('-->', i + 4)

          if (commentEnd < 0) { // didn't find -->
            return helper(end+1, lineNo+1, outputString+'\n')
          } else {
            commentEnd = commentEnd + 3
          }

          const content = inputString.slice(i+4, commentEnd-3).trim()
          const newlinesMatch = content.match(/\n/g)
          const newlines = (newlinesMatch ? newlinesMatch.length : 0)
          const optionsMatch = content.match(/^([^\s]+?)\s([\s\S]+)$/)
          const options = {lineNo}

          if (optionsMatch && optionsMatch[2]) {
            const rest = optionsMatch[2]
            const match = rest.match(/(?:[^\s\n:"']+|"[^"]*"|'[^']*')+/g) // split by space and \newline and : (not in single and double quotezz)

            if (match && match.length % 2 === 0) {
              let i = 0
              while (i < match.length) {
                const key = match[i],
                      value = match[i+1]
                try {
                  options[key] = JSON.parse(value)
                } catch (e) {
                  null // do nothing
                }
                i += 2
              }
            } 
          }

          if (subject === 'pagebreak' || subject === 'newpage') { // pagebreak
            return helper(commentEnd, lineNo + newlines, outputString + '<div class="pagebreak"> </div>\n')
          } else if (subject === 'slide') { // slide 
            slideConfigs.push(options)
            return helper(commentEnd, lineNo + newlines, outputString + '<span class="new-slide"></span>\n')
          }
        }
      } else if (line.match(/^\s*\[toc\]\s*$/i)) { // [TOC]
        if (forPreview) outputString += createAnchor(lineNo) // insert anchor for scroll sync
        tocBracketEnabled = true 
        return helper(end+1, lineNo+1, outputString + `\n[MPETOC]\n\n`)
      }

      // file import 
      let importMatch
      if (importMatch = line.match(/^(\s*)\@import(\s+)\"([^\"]+)\";?/)) {
        outputString += importMatch[1]
        const filePath = importMatch[3].trim()

        const leftParen = line.indexOf('{')
        let config = null
        let configStr = ''
        if (leftParen > 0) {
          const rightParen = line.lastIndexOf('}')
          if (rightParen > 0) {
            configStr = line.substring(leftParen+1, rightParen)
            try {
              config = jsonic(`{${configStr}}`)
            } catch(error) {
              // null
            }
          }
        }

        const start = lineNo
        let absoluteFilePath
        if (filePath.match(protocolsWhiteListRegExp))
          absoluteFilePath = filePath
        else if (filePath.startsWith('/'))
          absoluteFilePath = path.resolve(projectDirectoryPath, '.' + filePath)
        else
          absoluteFilePath = path.resolve(fileDirectoryPath, filePath)

        const extname = path.extname(filePath).toLocaleLowerCase()
        let output = ''
        if (['.jpeg', '.jpg', '.gif', '.png', '.apng', '.svg', '.bmp'].indexOf(extname) >= 0) { // image
          let imageSrc:string = filesCache[filePath]

          if (!imageSrc) {
            if (filePath.match(protocolsWhiteListRegExp))
              imageSrc = filePath
            else if (useRelativeImagePath)
              imageSrc = path.relative(fileDirectoryPath, absoluteFilePath) + '?' + Math.random()
            else 
              imageSrc = '/' + path.relative(projectDirectoryPath, absoluteFilePath) + '?' + Math.random()

            // enchodeURI(imageSrc) is wrong. It will cause issue on Windows
            // #414: https://github.com/shd101wyy/markdown-preview-enhanced/issues/414
            imageSrc = imageSrc.replace(/ /g, '%20')
            filesCache[filePath] = imageSrc
          }

          if (config) {
            if (config.width || config.height || config.class || config.id) {
              output = `<img src="${imageSrc}" `
              for (let key in config) {
                output += ` ${key}="${config[key]}" `
              }
              output += ">"
            } else {
              output = "!["
              if (config['alt'])
                output += config['alt']
              output += `](${imageSrc}`
              if (config['title'])
                output += ` "${config.title}"`
              output += ")  "
            }
          } else {
            output = `![](${imageSrc})  `
          }
          return helper(end+1, lineNo+1, outputString+output+'\n')
        }
        else {
          try {
            const fileContent = await loadFile(absoluteFilePath, {fileDirectoryPath, forPreview}, filesCache)
            filesCache[absoluteFilePath] = fileContent

            if (config && config['code_block']) {
              const fileExtension = extname.slice(1, extname.length)
              output = `\`\`\`${fileExtensionToLanguageMap[fileExtension] || fileExtension} ${JSON.stringify(config)}  \n${fileContent}\n\`\`\`  `
            }
            else if (config && config['cmd']) {
              if (!config['id']) { // create `id` for code chunk
                config['id'] = md5(absoluteFilePath)
              }

              const fileExtension = extname.slice(1, extname.length)
              output = `\`\`\`${fileExtensionToLanguageMap[fileExtension] || fileExtension} ${JSON.stringify(config)}  \n${fileContent}\n\`\`\`  `
            }
            else if (['.md', '.markdown', '.mmark'].indexOf(extname) >= 0) { // markdown files
              // this return here is necessary
              let {outputString:output} = await transformMarkdown(fileContent, {fileDirectoryPath: path.dirname(absoluteFilePath), projectDirectoryPath, filesCache, useRelativeImagePath: false, forPreview: false, protocolsWhiteListRegExp})
              output = '\n' + output + '  '
              return helper(end+1, lineNo+1, outputString+output+'\n')
            }
            else if (extname == '.html') { // html file
              output = '<div>' + fileContent + '</div>  '
            }
            else if (extname == '.csv') {  // csv file
              const parseResult = Baby.parse(fileContent.trim())
              if (parseResult.errors.length)
                output = `<pre>${parseResult.errors[0]}</pre>  `
              else {
                // format csv to markdown table
                output = _2DArrayToMarkdownTable(parseResult.data)
              }
            }
            else if (extname === '.css' || extname === '.less') { // css or less file
              output = `<style>${fileContent}</style>`
            }
            /*
            else if extname == '.pdf'
              if config?.page_no # only disply the nth page. 1-indexed
                pages = fileContent.split('\n')
                pageNo = parseInt(config.page_no) - 1
                pageNo = 0 if pageNo < 0
                output = pages[pageNo] or ''
              else if config?.page_begin or config?.page_end
                pages = fileContent.split('\n')
                pageBegin = parseInt(config.page_begin) - 1 or 0
                pageEnd = config.page_end or pages.length - 1
                pageBegin = 0 if pageBegin < 0
                output = pages.slice(pageBegin, pageEnd).join('\n') or ''
              else
                output = fileContent
            */
            else if (extname === '.dot' || extname === '.gv' || extname === '.viz') { // graphviz
              output = `\`\`\`dot\n${fileContent}\n\`\`\`  `
            }
            else if (extname === '.mermaid') { // mermaid
              output = `\`\`\`mermaid\n${fileContent}\n\`\`\`  `
            }
            else if (extname === '.plantuml' || extname === '.puml') { // PlantUML
              output = `\`\`\`puml\n' @mpe_file_directory_path:${path.dirname(absoluteFilePath)}\n${fileContent}\n\`\`\`  `
            }
            /*
            else if extname in ['.wavedrom']
              output = "```wavedrom\n${fileContent}\n```  "
              # filesCache?[absoluteFilePath] = output
            
            else if extname == '.js'
              if forPreview
                output = '' # js code is evaluated and there is no need to display the code.
              else
                if filePath.match(/^https?\:\/\//)
                  output = "<script src=\"${filePath}\"></script>"
                else
                  output = "<script>${fileContent}</script>"
            */
            else { // # codeblock
              const fileExtension = extname.slice(1, extname.length)
              output = `\`\`\`${fileExtensionToLanguageMap[fileExtension] || fileExtension} ${config ? JSON.stringify(config) : ''}  \n${fileContent}\n\`\`\`  `
            }

            return helper(end+1, lineNo+1, outputString+output+'\n')
          } catch(error) {
            output = `<pre>${error.toString()}</pre>  `
            return helper(end+1, lineNo+1, outputString+output+'\n')
          }
        }
      } else {
        return helper(end+1, lineNo+1, outputString+line+'\n')
      }
    }

    return await helper(0, 0, '')
}