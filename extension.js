const { commands, Position, Range, window } = require('vscode')

const onlyRegex = /(describe|context|it)(\.only)/g
const skipRegex = /(describe|context|it)(\.skip)/g
const modifiableRunnableRegex = /(describe|context|it)(?=[ (])/

const getLineText = (editor, startLine) => {
  const range = editor.document.lineAt(startLine).range
  return editor.document.getText(range)
}

const editEachSelection = (run) => {
  const editor = window.activeTextEditor
  if (!editor) return
  const selections = editor.selections
  if (!selections || !selections.length) return

  return editor.edit((edit) => {
    selections.reverse().forEach((selection) => {
      run(editor, edit, selection)
    })
  })
}

const addToSelections = (textToAdd) => () => {
  return editEachSelection((editor, edit, selection) => {
    let startLine = selection.start.line
    let match
    let text

    while (startLine >= 0) {
      text = getLineText(editor, startLine)
      match = text.match(modifiableRunnableRegex)
      if (match) break
      startLine--
    }

    if (!match) return

    const matchingWord = match[1]
    const index = text.indexOf(matchingWord) + matchingWord.length

    const position = new Position(startLine, index)
    edit.insert(position, textToAdd)
  })
}

const removeFromSelections = (textToRemove) => () => {
  editEachSelection((editor, edit, selection) => {
    let startLine = selection.start.line
    let text
    let index
    while (startLine >= 0) {
      text = getLineText(editor, startLine)
      index = text.indexOf(textToRemove)
      if (index >= 0) break
      startLine--
    }

    if (index < 0) return

    const start = new Position(startLine, index)
    const end = new Position(startLine, index + textToRemove.length)
    const range = new Range(start, end)
    edit.delete(range)
  })
}

const removeAll = (regex) => () => {
  const editor = window.activeTextEditor
  if (!editor) return

  const text = editor.document.getText()
  const edits = []
  let r
  // prevent mutating regex object for re-use later
  const re = new RegExp(regex)
  while ((r = re.exec(text)) !== null) {
    const result = r
    const startIndex = result.index + result[1].length
    const endIndex = startIndex + result[2].length
    edits.push((edit) => {
      const range = new Range(editor.document.positionAt(startIndex), editor.document.positionAt(endIndex))
      edit.replace(range, '')
    })
  }

  return editor.edit((edit) => {
    edits.forEach((v) => v(edit))
  })
}

const moveOnly = () => {
  return removeAll(onlyRegex)().then(() => {
    return addToSelections('.only')()
  })
}

module.exports = {
  activate (context) {
    const addOnlyCommand = commands.registerCommand('extension.addOnly', addToSelections('.only'))
    context.subscriptions.push(addOnlyCommand)
    const removeOnlyCommand = commands.registerCommand('extension.removeOnly', removeFromSelections('.only'))
    context.subscriptions.push(removeOnlyCommand)
    const removeAllOnlysCommand = commands.registerCommand('extension.removeAllOnlys', removeAll(onlyRegex))
    context.subscriptions.push(removeAllOnlysCommand)
    const moveOnlyCommand = commands.registerCommand('extension.moveOnly', moveOnly)
    context.subscriptions.push(moveOnlyCommand)

    const addSkipCommand = commands.registerCommand('extension.addSkip', addToSelections('.skip'))
    context.subscriptions.push(addSkipCommand)
    const removeSkipCommand = commands.registerCommand('extension.removeSkip', removeFromSelections('.skip'))
    context.subscriptions.push(removeSkipCommand)
    const removeAllSkipsCommand = commands.registerCommand('extension.removeAllSkips', removeAll(skipRegex))
    context.subscriptions.push(removeAllSkipsCommand)
  },
}
