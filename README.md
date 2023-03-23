# AI Code Helper

This extension utilizes GPT artificial intelligence to add comments to code, perform code reviews, and even refactor and generate code.  

[![Youtube Badge](https://img.shields.io/badge/Youtube-ff0000?style=flat-square&logo=youtube&link=https%3A%2F%2Fwww.youtube.com%2Fwatch%3Fv%3DSQPLPPb_LuE)](https://www.youtube.com/watch?v=SQPLPPb_LuE)
[![Gmail Badge](https://img.shields.io/badge/Gmail-d14836?style=flat-square&logo=Gmail&logoColor=white&link=mailto:monogatree@gmail.com)](mailto:monogatree@gmail.com)
[![VSCode Badge](https://img.shields.io/badge/Visual_Studio_Code-0078D4?style=flat-square&logo=visual%20studio%20code&logoColor=white)](https://marketplace.visualstudio.com/items?itemName=Kimseungtae.aicodehelper)

<img src="https://blog.kakaocdn.net/dn/050HO/btr2OStdFHu/dqokZRPisKgwkqReTjmjdk/img.gif" width="100%" />

---
## Requirements

To use this extension, you will need an API key for the GPT API provided by OpenAI.  
Please note that this extension operates based on OpenAI's GPT API, which means that every time you use the extension's features, a request will be made to the GPT API. Therefore, please be aware that there may be charges incurred depending on your usage.  
You can obtain an API key from here: https://platform.openai.com/account/api-keys  

---
## Powered by

This extension is powered by Chat Completion(model: gpt-3.5-turbo) API of OpenAI.

---
## Extension Settings

This extension contributes the following settings:
* `aicodehelper.language`: What language would you like AI to use? (ex: english, korean, chinese)
* `aicodehelper.namingprompt`: Prompt template to request naming variables from OpenAI
* `aicodehelper.debugprompt`: Prompt template to request debugging from OpenAI
* `aicodehelper.codereviewprompt`: Prompt template to request a code review from OpenAI
* `aicodehelper.refactoringprompt`: Prompt template to request a refactoring from OpenAI
* `aicodehelper.commmentingprompt`: Prompt template to request adding comments from OpenAI
* `aicodehelper.generatingprompt`: Prompt template to request generating code from OpenAI
* `aicodehelper.temperature`: Temperature for general requests

---
## Known Issues

The results obtained from GPT artificial intelligence while using this extension may contain errors or incorrect information. So, be sure to keep this in mind and use it. Users of this extension are solely responsible for its use.  

---
## How to use

AI Code Helper is a tool that automatically performs tasks such as adding comments, refactoring, code review, and general requests while writing code.  

### Preparation

1. Open VS Code and go to Settings by pressing `Cmd+,`.
2. Search for `aicodehelper` and check the settings values.
3. Set the language you want to use for GPT in `language`.
4. Set the API key for OpenAI, which can be obtained from [OpenAI](https://platform.openai.com/account/api-keys), by pressing shortcut `Ctrl+Shift+Alt+Q`.
5. You can optionally modify the `prompt template`.

### Usage
1. **Adding Comments**  
   Comments play an important role in coding.  
   It checks the meaning of the programming code that has been written and adds comments to the code accordingly.  
   <img src="https://blog.kakaocdn.net/dn/bNM7Lr/btr2TC3VdgJ/3WlDMegYVucPwOANBQVRtk/img.gif" width="100%" />  
   Select the code you want to add a comment to in the code editor and press `Ctrl+Shift+Alt+Z`.  
   If you press the shortcut key without making a selection, it automatically selects the line where the cursor is located.  

   *Select the code that looks like the one shown below and press the shortcut.*
      ```javascript
      for(let i=0;i<10;i++) {  
         code();  
         main();  
      }  
      ```

   *This will be converted like*  
      ```javascript
      // Using a for loop to iterate from 0 to 9.
      for(let i=0;i<10;i++) {
         // Calling the function "code".
         code();
         // Calling the function "main".
         main();
      }  // End of the for loop.
      ```

2. **Refactoring**  
   This feature uses artificial intelligence to refactor code.  
   <img src="https://blog.kakaocdn.net/dn/bNM7Lr/btr2TC3VdgJ/3WlDMegYVucPwOANBQVRtk/img.gif" width="100%" />  
   Select the code you want to refactor in the code editor and press `Ctrl+Shift+Alt+R`.  
   If you press the shortcut key without making a selection, it automatically selects the line where the cursor is located.  

   *Select the code that looks like the one shown below and press the shortcut.*
      ```javascript
      let a = 20;
      if(a==30){
         console.log('d is 300')
      }
      if(a==10){
         console.log('d is 100')
      }
      if(a==20){
         console.log('d is 200')
      }
      ```

   *This will be converted like*  
      ```javascript
      const a = 20;
      const conditions = {
         30: 'd is 300',
         10: 'd is 100',
         20: 'd is 200'
      };
      if (conditions[a]) {
         console.log(conditions[a]);
      }
      ```

3. **Code Review**  
   This feature uses artificial intelligence to identify the strengths and weaknesses of the code and provide code reviews.  
   <img src="https://blog.kakaocdn.net/dn/bNM7Lr/btr2TC3VdgJ/3WlDMegYVucPwOANBQVRtk/img.gif" width="100%" />  
   Select the code you want to review in the code editor and press `Ctrl+Shift+Alt+C`.  
   If you press the shortcut key without making a selection, it automatically selects the line where the cursor is located.  

   *Select the code that looks like the one shown below and press the shortcut.*
      ```javascript
      let a = 20;
      if(a==30){
         console.log('d is 300')
      }
      if(a==10){
         console.log('d is 100')
      }
      if(a==20){
         console.log('d is 200')
      }
      ```

   *This will be converted like*  
      ```javascript
      // Good part: 
      // The code correctly checks the value of variable "a" against different conditions and prints the corresponding message when the condition is true. 
      // Bad part: 
      // The code uses multiple if statements instead of else if or switch statement, which can result in unnecessary checks and slower performance. Additionally, there is no default or catch-all condition for when "a" does not match any of the given conditions, so the code will not output anything in that case.
      let a = 20;
      if(a==30){
         console.log('d is 300')
      }
      if(a==10){
         console.log('d is 100')
      }
      if(a==20){
         console.log('d is 200')
      }
      ```

4. **General Requests**  
   This feature uses artificial intelligence to handle requests for various queries beyond programming code.  
   <img src="https://blog.kakaocdn.net/dn/bNM7Lr/btr2TC3VdgJ/3WlDMegYVucPwOANBQVRtk/img.gif" width="100%" />  
   Select the code you want to request in the code editor and press `Ctrl+Shift+Alt+M`.  
   The language setting does not apply to this feature.  
   Therefore, if you want to specify the language for the AI's response, you need to mention the language in the text that will be selected.  
   If you press the shortcut key without making a selection, it automatically selects the line where the cursor is located.  

   *Select the code that looks like the one shown below and press the shortcut.*
      ```text
      Write a lyrics praise javascript in a style of a song "Ain't no mountain high enough".
      ```

   *This will be converted like*  
      ```text
      (Verse 1)
      There ain't no code too complex
      No function too hard to execute
      With JavaScript by my side
      I can conquer any coding plight

      (Chorus)
      Ain't no problem too big
      Ain't no bug too tough
      With JavaScript on my side
      I can make anything work

      (Verse 2)
      From web pages to apps
      From front-end to back-end
      JavaScript is the glue that holds it all
      Together, seamless and smooth
      ...   
      ```

5. **Code Generating**  
   This feature uses artificial intelligence to generate code based on the description of the desired functionality provided in the explanation.  
   <img src="https://blog.kakaocdn.net/dn/bNM7Lr/btr2TC3VdgJ/3WlDMegYVucPwOANBQVRtk/img.gif" width="100%" />  
   Select the code you want to request in the code editor and press `Ctrl+Shift+Alt+G`.  
   If you press the shortcut key without making a selection, it automatically selects the line where the cursor is located.  

   *Select the code that looks like the one shown below and press the shortcut.*
      ```text
      Make a function that take two arguments and plus them and return.
      ```

   *This will be converted like*  
      ```python
      # Define a function that takes two arguments
      def add_two_numbers(num1, num2):
         # Add the two numbers
         result = num1 + num2
         # Return the result
         return result
      ```
6. **General Requests with Inputbox**  
   This feature is useful when you want to request additional processing for something that has already been created.  
   <img src="https://blog.kakaocdn.net/dn/TEKHP/btr3dDug45L/HaOxtv8CXeQBYHa8sBnQy0/img.gif" width="100%" />  
   Select the code you want to request in the code editor and press `Ctrl+Shift+Alt+,(comma)`.  
   The language setting does not apply to this feature.  
   Therefore, if you want to specify the language for the AI's response, you need to mention the language in the text that will be selected.  
   If you press the shortcut key without making a selection, it automatically selects the line where the cursor is located.  
   The prompt entered in this way can be reused later using the shortcut key `Ctrl+Shift+Alt+.(full stop)`, and this record can be reset using the shortcut key `Ctrl+Shift+Alt+(back tick)`.  
   The biggest difference between `Ctrl+Shift+Alt+M` and `Ctrl+Shift+Alt+,(comma)` is how you input your request to AI.
   When using `Ctrl+Shift+Alt+M`, you include your request to AI in the selected text.  

   *An example of selected text of `Ctrl+Shift+Alt+M`*  
      ```text
      [
         ["name", "color", "price"],
         ["apple", "red", 100],
         ["mango", "yellow", 150]
         ["banana", "yellow", 125],
      ]
      Please convert this JSON array to an HTML table.
      ```
   When using `Ctrl+Shift+Alt+,(comma)`, your request to AI is not included in the selected text. Instead, you create an input box by pressing a shortcut key and enter your request (*`Please convert this JSON array to an HTML table.`*) to AI in this input box.  

   *An example of selected text of `Ctrl+Shift+Alt+,(comma)`*  
      ```text
      [
         ["name", "color", "price"],
         ["apple", "red", 100],
         ["mango", "yellow", 150]
         ["banana", "yellow", 125],
      ]
      ```

   *This will be converted like*  
      ```html
      <table>
         <tr>
            <th>name</th>
            <th>color</th>
            <th>price</th>
         </tr>
         <tr>
            <td>apple</td>
            <td>red</td>
            <td>100</td>
         </tr>
         <tr>
            <td>mango</td>
            <td>yellow</td>
            <td>150</td>
         </tr>
         <tr>
            <td>banana</td>
            <td>yellow</td>
            <td>125</td>
         </tr>
      </table>
      ```
7. **Naming variables, functions, etc**  
   It is a function that solves the problem of naming, which is the most difficult part of coding.  
   <img src="https://blog.kakaocdn.net/dn/djHq9D/btr34BChNMB/nrs95N0A0PjkvKBCzB83PK/img.gif" width="100%" />  
   Select the code you want to rename in the code editor and press `Ctrl+Shift+Alt+N`.  
   If you press the shortcut key without making a selection, it automatically selects the line where the cursor is located.  

   *Select the code that looks like the one shown below and press the shortcut.*
      ```javascript
      let a = 6;
      let b = [5, 3, 7, 6, 8, 9];
      let c = false;
      for (let i = 0; i < b.length; i++) {
         if (a == b[i]) {
            c = true;
         }
      }
      console.log(c);
      ```

   *This will be converted like*  
      ```javascript
      let searchValue = 6;
      let arrayToSearch = [5, 3, 7, 6, 8, 9];
      let isValueFound = false;
      for (let i = 0; i < arrayToSearch.length; i++) {
         if (searchValue == arrayToSearch[i]) {
            isValueFound = true;
         }
      }
      console.log(isValueFound);
      ```
---
## License

Licensed under the [MIT](https://github.com/kstost/aicodehelper/blob/main/LICENSE) License.
