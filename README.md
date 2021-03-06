# Markdown Preview Enhanced

Trying hard to port [Markdown Preview Enhanced for Atom](https://github.com/shd101wyy/markdown-preview-enhanced) to vscode.

First time to write typescript, and it is awesome. I think I will write all my web projects in TypeScript from now on.  

Below is a demo of the Atom version.   

![](https://user-images.githubusercontent.com/1908863/26898176-a5cad7fc-4b90-11e7-9d8c-74f85f28f133.gif)

## Features

Right now only 50% done:   
* <kbd>ctrl-shift-m</kbd> for `Markdown Preview Enhanced: Open Preview` command.  
* <kbd>ctrl-shift-i</kbd> for `Markdown Preview Enhanced: Image Helper` command.    
    * Support uploading images to either `imgur` or `sm.ms`.  
![Screen Shot 2017-06-15 at 1.31.01 AM](https://ooo.0o0.ooo/2017/06/15/59422aa748341.png)  
* <kbd>shift-enter</kbd> for `Markdown Preview Enhanced: Run Code Chunk` command.  
* <kbd>ctrl-shift-enter</kbd> for `Markdown Preview Enhanced: Run All Code Chunks` command.  

* **Right Click** at the Preview to see the contextmenu
![Screen Shot 2017-06-15 at 1.36.32 AM](https://ooo.0o0.ooo/2017/06/15/59422b1ab3931.png)

For more features that will be supported in the future, check [Markdown Preview Enhanced for atom](https://shd101wyy.github.io/markdown-preview-enhanced/#/).

### Progress so far 
#### June 16, 2017
* Done supporting [eBook export](https://shd101wyy.github.io/markdown-preview-enhanced/#/ebook).  
* [@import](https://shd101wyy.github.io/markdown-preview-enhanced/#/file-imports) 70% done. Now support importing every external files except `.js` and `.pdf` files.  
* Done implementing refresh button in preview.  
* [Code Chunk](https://shd101wyy.github.io/markdown-preview-enhanced/#/code-chunk) implementation is now 60% done. LaTeX and JavaScript don't work yet.    
Please note that Code Chunk of [Markdown Preview Enhanced for Atom](https://shd101wyy.github.io/markdown-preview-enhanced/#/code-chunk) is outdated. The syntax of the vscode version is the newest. You need to have `cmd` set to declare a code chunk.  

![Screen Shot 2017-06-16 at 10.23.49 PM](https://ooo.0o0.ooo/2017/06/17/5944a2b03d954.png).  


#### June 14, 2017
* Scroll sync is partially done.
* Done supporting `mermaid`, `PlantUML` and `viz.js` (GraphViz). 
* Done supporting `[TOC]`.  
* Done supporting `MathJax` and `KaTeX`.
* Done sidebar TOC.  
* Done back to top button.  
* Done supporting front matter.
* Done supporting `reveal.js` presentation mode. Try inserting `<!-- slide -->` to your markdown.  
* Done `Open in Browser`. 
* Done HTML export.  
* Done `prince` PDF export.  
* Done `Image Helper`.  
* Done supporting single preview.  




## Requirements

TODO

## My Questions
It would be great if you can answer my following questions to help develop this extension.  
1. Is the a `onDidChangeScrollTop` function for `TextEditor` in vscode. So that I can track the change of scrollTop position of the text editor.  
1. Can I manually set the `scrollTop` of `TextEditor`?
1. How to programmatically close my preview by `uri`? I tried to implement the `Toggle Preview` command but failed because I don't know how to close a preview. So now only `Open Preview` is provided.  

## Extension Settings

Search `markdown-preview-enhanced` in settings.  

## Known Issues

TODO

## Release Notes

TODO