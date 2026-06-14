const renderKSScript = async (outputScript) => {
  const $textarea = $("#export-to-KS-script");
  const textarea = $textarea.get(0);

  const codeMirrorOptions = {
    lineNumbers: true,
    matchBrackets: true,
    readOnly: true,
    lineWrapping: true,
    mode: 'text/x-groovy'
  };
  let codeMirror = $textarea.data('cm');
  if (codeMirror) {
    codeMirror.toTextArea();
  }
  $textarea.data('cm', null);
  textarea.value = outputScript;
  codeMirror = CodeMirror.fromTextArea(textarea, codeMirrorOptions);
  $('.CodeMirror').removeClass('kat-90').addClass('kat-75');
  $textarea.data('cm', codeMirror);
}

export { renderKSScript }