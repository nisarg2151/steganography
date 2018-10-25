    <input type="hidden" name="group" value="{{group}}">
      {{#names}}
        <div class="image">
          <img src="{{{imagesUrl}}}/{{group}}/{{name}}.png" alt="{{name}}"><br>
          <input type="radio" name="name" value="{{name}}" {{checked}}>
	  {{#label}}{{name}}{{/label}}
	</div>
      {{/names}}
    </table>
    
