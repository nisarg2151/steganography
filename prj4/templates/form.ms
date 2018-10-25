<!DOCTYPE html>
<html>
  <head>
    <title>Steg {{cmd}}</title>
    <link rel="stylesheet" href="{{{base}}}/css/style.css">
  </head>
  <body>
    <h1 class="title">Steg {{cmd}}</h1>

    <ul>
      {{#errors}}
        <li class="error">{{.}}</li>
      {{/errors}}
    </ul>
    {{#names.length}}
    {{#isHide}}
    <form action="hide.html" method="POST" enctype="multipart/form-data">
      <p>Please select an image below to hide the message:</p>
      {{>images}}
      <p>
        Please choose a file containing the message to hide or
	enter the message into the text box and then hit the
	<strong>Hide</strong> button.
      </p>
      <fieldset>
        <label for="file">Message File:</label>
        <input id="file" type="file" name="msgFile">
      </fieldset>
      <fieldset>
        <label for="text">Message:</label><br>
        <textarea name="message" cols="80" rows="10">{{message}}</textarea><br>
      </fieldset>
     {{/isHide}}
     {{^isHide}}
     <form action="unhide.html" method="POST">
      <p>
        Please select an image below containing the message to be
	recovered and then hit the <strong>Unhide</strong> button.
      </p>
      {{>images}}
     {{/isHide}}
     <div class="submit">
       <input type="submit" name="submit" value="{{cmd}}"><br>
     </div>
    </form>
    {{/names.length}}

    {{^names.length}}
      <p>There are no images to {{cmd}}</p>
    {{/names.length}}

    <p><a href="hide.html">Hide</a> | <a href="unhide.html">Unhide</a></p>  

  </body>
</html>
