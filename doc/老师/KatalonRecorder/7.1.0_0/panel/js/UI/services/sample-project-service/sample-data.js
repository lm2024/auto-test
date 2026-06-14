const sampleData = [{
    testSuiteName: "Common actions",
    projectName: "Basic automation",
    description: "Click, type and add selection",
    testSuite: `<?xml version="1.0" encoding="UTF-8"?>
<!DOCTYPE html PUBLIC "-//W3C//DTD XHTML 1.0 Strict//EN" "http://www.w3.org/TR/xhtml1/DTD/xhtml1-strict.dtd">
<html xmlns="http://www.w3.org/1999/xhtml" xml:lang="en" lang="en">
<head>
  <meta content="text/html; charset=UTF-8" http-equiv="content-type" />
  <title>Common actions</title>
</head>
<body>
<table cellpadding="1" cellspacing="1" border="1">
  <thead>
  <tr><td rowspan="1" colspan="3">Common actions</td></tr>
  </thead>
  <tbody>
  <tr><td>open</td><td>https://katalon-test.s3.amazonaws.com/aut/html/form.html<datalist><option>https://katalon-test.s3.amazonaws.com/aut/html/form.html</option></datalist></td><td></td>
  </tr>
  <tr><td>#</td><td>This is a comment.<datalist><option>This is a comment.</option></datalist></td><td></td>
  </tr>
  <tr><td>click</td><td>id=first-name<datalist><option>id=first-name</option><option>name=firstName</option><option>//input[@id='first-name']</option><option>//form[@id='infoForm']/div/div/input</option><option>//input</option><option>css=#first-name</option></datalist></td><td></td>
  </tr>
  <tr><td>type</td><td>id=first-name<datalist><option>id=first-name</option><option>name=firstName</option><option>//input[@id='first-name']</option><option>//form[@id='infoForm']/div/div/input</option><option>//input</option><option>css=#first-name</option></datalist></td><td>Alex</td>
  </tr>
  <tr><td>type</td><td>id=last-name<datalist><option>id=last-name</option><option>name=lastName</option><option>//input[@id='last-name']</option><option>//form[@id='infoForm']/div[2]/div/input</option><option>//div[2]/div/input</option><option>css=#last-name</option></datalist></td><td>Smith</td>
  </tr>
  <tr><td>click</td><td>name=gender<datalist><option>name=gender</option><option>//input[@name='gender']</option><option>//form[@id='infoForm']/div[3]/div/div/label/input</option><option>//label/input</option><option>css=input[name="gender"]</option></datalist></td><td></td>
  </tr>
  <tr><td>click</td><td>id=dob<datalist><option>id=dob</option><option>name=dob</option><option>//input[@id='dob']</option><option>//form[@id='infoForm']/div[4]/div/input</option><option>//div[4]/div/input</option><option>css=#dob</option></datalist></td><td></td>
  </tr>
  <tr><td>click</td><td>//tr[4]/td[3]<datalist><option>//tr[4]/td[3]</option></datalist></td><td></td>
  </tr>
  <tr><td>click</td><td>id=address<datalist><option>id=address</option><option>name=address</option><option>//input[@id='address']</option><option>//form[@id='infoForm']/div[5]/div/input</option><option>//div[5]/div/input</option><option>css=#address</option></datalist></td><td></td>
  </tr>
  <tr><td>type</td><td>id=address<datalist><option>id=address</option><option>name=address</option><option>//input[@id='address']</option><option>//form[@id='infoForm']/div[5]/div/input</option><option>//div[5]/div/input</option><option>css=#address</option></datalist></td><td>123456 Wakanda</td>
  </tr>
  <tr><td>click</td><td>id=email<datalist><option>id=email</option><option>name=email</option><option>//input[@id='email']</option><option>//form[@id='infoForm']/div[6]/div/input</option><option>//div[6]/div/input</option><option>css=#email</option></datalist></td><td></td>
  </tr>
  <tr><td>type</td><td>id=email<datalist><option>id=email</option><option>name=email</option><option>//input[@id='email']</option><option>//form[@id='infoForm']/div[6]/div/input</option><option>//div[6]/div/input</option><option>css=#email</option></datalist></td><td>alex@wakanda.gov</td>
  </tr>
  <tr><td>click</td><td>id=password<datalist><option>id=password</option><option>name=password</option><option>//input[@id='password']</option><option>//form[@id='infoForm']/div[7]/div/input</option><option>//div[7]/div/input</option><option>css=#password</option></datalist></td><td></td>
  </tr>
  <tr><td>type</td><td>id=password<datalist><option>id=password</option><option>name=password</option><option>//input[@id='password']</option><option>//form[@id='infoForm']/div[7]/div/input</option><option>//div[7]/div/input</option><option>css=#password</option></datalist></td><td>secret</td>
  </tr>
  <tr><td>click</td><td>id=company<datalist><option>id=company</option><option>name=company</option><option>//input[@id='company']</option><option>//form[@id='infoForm']/div[8]/div/input</option><option>//div[8]/div/input</option><option>css=#company</option></datalist></td><td></td>
  </tr>
  <tr><td>type</td><td>id=company<datalist><option>id=company</option><option>name=company</option><option>//input[@id='company']</option><option>//form[@id='infoForm']/div[8]/div/input</option><option>//div[8]/div/input</option><option>css=#company</option></datalist></td><td>Dora</td>
  </tr>
  <tr><td>select</td><td>id=role<datalist><option>id=role</option><option>name=role</option><option>//select[@id='role']</option><option>//form[@id='infoForm']/div[9]/div/select</option><option>//select</option><option>css=#role</option></datalist></td><td>label=Manager</td>
  </tr>
  <tr><td>click</td><td>id=role<datalist><option>id=role</option><option>name=role</option><option>//select[@id='role']</option><option>//form[@id='infoForm']/div[9]/div/select</option><option>//select</option><option>css=#role</option></datalist></td><td></td>
  </tr>
  <tr><td>addSelection</td><td>id=expectation<datalist><option>id=expectation</option><option>name=expectation</option><option>//select[@id='expectation']</option><option>//form[@id='infoForm']/div[10]/div/select</option><option>//div[10]/div/select</option><option>css=#expectation</option></datalist></td><td>label=Nice manager/leader</td>
  </tr>
  <tr><td>click</td><td>//select[@id='expectation']/option[2]<datalist><option>//select[@id='expectation']/option[2]</option><option>//div[10]/div/select/option[2]</option></datalist></td><td></td>
  </tr>
  <tr><td>addSelection</td><td>id=expectation<datalist><option>id=expectation</option><option>name=expectation</option><option>//select[@id='expectation']</option><option>//form[@id='infoForm']/div[10]/div/select</option><option>//div[10]/div/select</option><option>css=#expectation</option></datalist></td><td>label=Excellent colleagues</td>
  </tr>
  <tr><td>click</td><td>//select[@id='expectation']/option[3]<datalist><option>//select[@id='expectation']/option[3]</option><option>//div[10]/div/select/option[3]</option></datalist></td><td></td>
  </tr>
  <tr><td>addSelection</td><td>id=expectation<datalist><option>id=expectation</option><option>name=expectation</option><option>//select[@id='expectation']</option><option>//form[@id='infoForm']/div[10]/div/select</option><option>//div[10]/div/select</option><option>css=#expectation</option></datalist></td><td>label=Good teamwork</td>
  </tr>
  <tr><td>click</td><td>//select[@id='expectation']/option[4]<datalist><option>//select[@id='expectation']/option[4]</option><option>//div[10]/div/select/option[4]</option></datalist></td><td></td>
  </tr>
  <tr><td>click</td><td>//input[@value='']<datalist><option>//input[@value='']</option><option>//form[@id='infoForm']/div[11]/div/div/label/input</option><option>//div[11]/div/div/label/input</option><option>css=input[type="checkbox"]</option></datalist></td><td></td>
  </tr>
  <tr><td>click</td><td>xpath=(//input[@value=''])[2]<datalist><option>xpath=(//input[@value=''])[2]</option><option>//form[@id='infoForm']/div[11]/div/div[2]/label/input</option><option>//div[2]/label/input</option></datalist></td><td></td>
  </tr>
  <tr><td>click</td><td>id=comment<datalist><option>id=comment</option><option>name=comment</option><option>//textarea[@id='comment']</option><option>//form[@id='infoForm']/div[12]/div/textarea</option><option>//textarea</option><option>css=#comment</option></datalist></td><td></td>
  </tr>
  <tr><td>type</td><td>id=comment<datalist><option>id=comment</option><option>name=comment</option><option>//textarea[@id='comment']</option><option>//form[@id='infoForm']/div[12]/div/textarea</option><option>//textarea</option><option>css=#comment</option></datalist></td><td>Added by Alex.</td>
  </tr>
  <tr><td>click</td><td>id=submit<datalist><option>id=submit</option><option>//button[@id='submit']</option><option>//form[@id='infoForm']/div[13]/div/button</option><option>//button</option><option>css=#submit</option></datalist></td><td></td>
  </tr>
  </tbody></table>
</body>
</html>`,
},
{
    testSuiteName: "Capture screenshots",
    projectName: "Capture screenshots",
    description: "Capture the screenshot of an entire page",
    testSuite: `<?xml version="1.0" encoding="UTF-8"?>
<!DOCTYPE html PUBLIC "-//W3C//DTD XHTML 1.0 Strict//EN" "http://www.w3.org/TR/xhtml1/DTD/xhtml1-strict.dtd">
<html xmlns="http://www.w3.org/1999/xhtml" xml:lang="en" lang="en">
<head>
  <meta content="text/html; charset=UTF-8" http-equiv="content-type" />
  <title>Capture screenshots</title>
</head>
<body>
<table cellpadding="1" cellspacing="1" border="1">
  <thead>
  <tr><td rowspan="1" colspan="3">Capture screenshots</td></tr>
  </thead>
  <tbody>
  <tr><td>open</td><td>https://katalon-test.s3.amazonaws.com/aut/html/form.html<datalist><option>https://katalon-test.s3.amazonaws.com/aut/html/form.html</option></datalist></td><td></td>
  </tr>
  <tr><td>captureEntirePageScreenshot</td><td>before-adding-comment<datalist><option>before-adding-comment</option></datalist></td><td></td>
  </tr>
  <tr><td>click</td><td>id=comment<datalist><option>id=comment</option><option>name=comment</option><option>//textarea[@id='comment']</option><option>//form[@id='infoForm']/div[12]/div/textarea</option><option>//textarea</option><option>css=#comment</option></datalist></td><td></td>
  </tr>
  <tr><td>type</td><td>id=comment<datalist><option>id=comment</option><option>name=comment</option><option>//textarea[@id='comment']</option><option>//form[@id='infoForm']/div[12]/div/textarea</option><option>//textarea</option><option>css=#comment</option></datalist></td><td>Added by Alex.</td>
  </tr>
  <tr><td>captureEntirePageScreenshot</td><td>after-adding-comment<datalist><option>after-adding-comment</option></datalist></td><td></td>
  </tr>
  </tbody></table>
</body>
</html>`,
},
{
    testSuiteName: "Working with variables",
    projectName: "Combine values",
    description: "Store and combine values from different text/input fields",
    testSuite: "<?xml version=\"1.0\" encoding=\"UTF-8\"?>\n" +
        "<!DOCTYPE html PUBLIC \"-//W3C//DTD XHTML 1.0 Strict//EN\" \"http://www.w3.org/TR/xhtml1/DTD/xhtml1-strict.dtd\">\n" +
        "<html xmlns=\"http://www.w3.org/1999/xhtml\" xml:lang=\"en\" lang=\"en\">\n" +
        "<head>\n" +
        "  <meta content=\"text/html; charset=UTF-8\" http-equiv=\"content-type\" />\n" +
        "  <title>Working with variables</title>\n" +
        "</head>\n" +
        "<body>\n" +
        "<table cellpadding=\"1\" cellspacing=\"1\" border=\"1\">\n" +
        "  <thead>\n" +
        "  <tr><td rowspan=\"1\" colspan=\"3\">Working with variables</td></tr>\n" +
        "  </thead>\n" +
        "  <tbody>\n" +
        "  <tr><td>open</td><td>https://katalon-test.s3.amazonaws.com/aut/html/form.html<datalist><option>https://katalon-test.s3.amazonaws.com/aut/html/form.html</option></datalist></td><td></td>\n" +
        "  </tr>\n" +
        "  <tr><td>store</td><td>Alex<datalist><option>Alex</option></datalist></td><td>author</td>\n" +
        "  </tr>\n" +
        "  <tr><td>store</td><td>Alex<datalist><option>Alex</option></datalist></td><td>Name with spaces also works. See tab Variables.</td>\n" +
        "  </tr>\n" +
        "  <tr><td>storeEval</td><td>new Date().toString()<datalist><option>new Date().toString()</option></datalist></td><td>time</td>\n" +
        "  </tr>\n" +
        "  <tr><td>storeTitle</td><td>page<datalist><option>page</option></datalist></td><td></td>\n" +
        "  </tr>\n" +
        "  <tr><td>echo</td><td>Added by ${author}. Time: ${time}. Page: ${page}.<datalist><option>Added by ${author}. Time: ${time}. Page: ${page}.</option></datalist></td><td></td>\n" +
        "  </tr>\n" +
        "  <tr><td>storeEval</td><td>storedVars['author'] + \"${page}\"<datalist><option>storedVars['author'] + ${page}</option><option>storedVars['author'] + \"${page}\"</option></datalist></td><td>demo1</td>\n" +
        "  </tr>\n" +
        "  <tr><td>echo</td><td>${demo1}<datalist><option>${demo}</option><option>${demo1}</option></datalist></td><td></td>\n" +
        "  </tr>\n" +
        "  <tr><td>storeEval</td><td>author + page<datalist><option>author + page</option></datalist></td><td>demo2</td>\n" +
        "  </tr>\n" +
        "  <tr><td>echo</td><td>${demo2}<datalist><option>${demo2}</option></datalist></td><td></td>\n" +
        "  </tr>\n" +
        "  <tr><td>click</td><td>id=comment<datalist><option>id=comment</option><option>name=comment</option><option>//textarea[@id='comment']</option><option>//form[@id='infoForm']/div[12]/div/textarea</option><option>//textarea</option><option>css=#comment</option></datalist></td><td></td>\n" +
        "  </tr>\n" +
        "  <tr><td>type</td><td>id=comment<datalist><option>id=comment</option><option>name=comment</option><option>//textarea[@id='comment']</option><option>//form[@id='infoForm']/div[12]/div/textarea</option><option>//textarea</option><option>css=#comment</option></datalist></td><td>Added by ${author}. Time: ${time}. Page: ${page}.</td>\n" +
        "  </tr>\n" +
        "  <tr><td>storeEval</td><td>1<datalist><option>1</option></datalist></td><td>a</td>\n" +
        "  </tr>\n" +
        "  <tr><td>storeEval</td><td>a+1<datalist><option>a+1</option></datalist></td><td>b</td>\n" +
        "  </tr>\n" +
        "  <tr><td>storeEval</td><td>b+1<datalist><option>b+1</option></datalist></td><td>c</td>\n" +
        "  </tr>\n" +
        "  <tr><td>type</td><td>id=comment<datalist><option>id=comment</option></datalist></td><td>${a} ${b} ${c}</td>\n" +
        "  </tr>\n" +
        "  </tbody></table>\n" +
        "</body>\n" +
        "</html>",
},
{
    testSuiteName: "Manipulate page’s Javascript variables",
    projectName: "Execute Javascript",
    description: "Execute javascript and use the returned values",
    testSuite: "<?xml version=\"1.0\" encoding=\"UTF-8\"?>\n" +
        "<!DOCTYPE html PUBLIC \"-//W3C//DTD XHTML 1.0 Strict//EN\" \"http://www.w3.org/TR/xhtml1/DTD/xhtml1-strict.dtd\">\n" +
        "<html xmlns=\"http://www.w3.org/1999/xhtml\" xml:lang=\"en\" lang=\"en\">\n" +
        "<head>\n" +
        "  <meta content=\"text/html; charset=UTF-8\" http-equiv=\"content-type\" />\n" +
        "  <title>Manipulate page's JavaScript variables</title>\n" +
        "</head>\n" +
        "<body>\n" +
        "<table cellpadding=\"1\" cellspacing=\"1\" border=\"1\">\n" +
        "  <thead>\n" +
        "  <tr><td rowspan=\"1\" colspan=\"3\">Manipulate page's JavaScript variables</td></tr>\n" +
        "  </thead>\n" +
        "  <tbody>\n" +
        "  <tr><td>open</td><td>https://katalon-test.s3.amazonaws.com/aut/html/form.html<datalist><option>https://katalon-test.s3.amazonaws.com/aut/html/form.html</option></datalist></td><td></td>\n" +
        "  </tr>\n" +
        "  <tr><td>runScript</td><td>return window.$.fn.jquery<datalist><option>window.$.fn.jquery</option><option>return window.$.fn.jquery</option></datalist></td><td>jQueryVersion</td>\n" +
        "  </tr>\n" +
        "  <tr><td>echo</td><td>${jQueryVersion}<datalist><option>${jQueryVersion}</option></datalist></td><td></td>\n" +
        "  </tr>\n" +
        "  <tr><td>runScript</td><td>window.text=10<datalist><option>window.text=10</option></datalist></td><td></td>\n" +
        "  </tr>\n" +
        "  <tr><td>runScript</td><td>return window.text<datalist><option>return window.text</option></datalist></td><td>text</td>\n" +
        "  </tr>\n" +
        "  <tr><td>echo</td><td>${text}<datalist><option>${text}</option></datalist></td><td></td>\n" +
        "  </tr>\n" +
        "  </tbody></table>\n" +
        "</body>\n" +
        "</html>",
},
{
    testSuiteName: "Verify",
    projectName: "Verify if field values are expected",
    description: "Verify if error messages are displayed for invalid inputs",
    testSuite: "<?xml version=\"1.0\" encoding=\"UTF-8\"?>\n" +
        "<!DOCTYPE html PUBLIC \"-//W3C//DTD XHTML 1.0 Strict//EN\" \"http://www.w3.org/TR/xhtml1/DTD/xhtml1-strict.dtd\">\n" +
        "<html xmlns=\"http://www.w3.org/1999/xhtml\" xml:lang=\"en\" lang=\"en\">\n" +
        "<head>\n" +
        "  <meta content=\"text/html; charset=UTF-8\" http-equiv=\"content-type\" />\n" +
        "  <title>Verify</title>\n" +
        "</head>\n" +
        "<body>\n" +
        "<table cellpadding=\"1\" cellspacing=\"1\" border=\"1\">\n" +
        "  <thead>\n" +
        "  <tr><td rowspan=\"1\" colspan=\"3\">Verify</td></tr>\n" +
        "  </thead>\n" +
        "  <tbody>\n" +
        "  <tr><td>open</td><td>https://katalon-test.s3.amazonaws.com/aut/html/form.html<datalist><option>https://katalon-test.s3.amazonaws.com/aut/html/form.html</option></datalist></td><td></td>\n" +
        "  </tr>\n" +
        "  <tr><td>click</td><td>id=first-name<datalist><option>id=first-name</option><option>name=firstName</option><option>//input[@id='first-name']</option><option>//form[@id='infoForm']/div/div/input</option><option>//input</option><option>css=#first-name</option></datalist></td><td></td>\n" +
        "  </tr>\n" +
        "  <tr><td>type</td><td>id=first-name<datalist><option>id=first-name</option><option>name=firstName</option><option>//input[@id='first-name']</option><option>//form[@id='infoForm']/div/div/input</option><option>//input</option><option>css=#first-name</option></datalist></td><td>Alex</td>\n" +
        "  </tr>\n" +
        "  <tr><td>type</td><td>id=last-name<datalist><option>id=last-name</option><option>name=lastName</option><option>//input[@id='last-name']</option><option>//form[@id='infoForm']/div[2]/div/input</option><option>//div[2]/div/input</option><option>css=#last-name</option></datalist></td><td>Smith</td>\n" +
        "  </tr>\n" +
        "  <tr><td>click</td><td>id=submit<datalist><option>id=submit</option><option>//button[@id='submit']</option><option>//form[@id='infoForm']/div[13]/div/button</option><option>//button</option><option>css=#submit</option></datalist></td><td></td>\n" +
        "  </tr>\n" +
        "  <tr><td>verifyText</td><td>id=gender-error<datalist><option>id=gender-error</option><option>//label[@id='gender-error']</option><option>//form[@id='infoForm']/div[3]/div/label</option><option>//div[3]/div/label</option><option>css=#gender-error</option></datalist></td><td>This field is required.</td>\n" +
        "  </tr>\n" +
        "  <tr><td>verifyText</td><td>id=dob-error<datalist><option>id=dob-error</option><option>//label[@id='dob-error']</option><option>//form[@id='infoForm']/div[4]/div/label</option><option>//div[4]/div/label</option><option>css=#dob-error</option></datalist></td><td>glob:*required*</td>\n" +
        "  </tr>\n" +
        "  <tr><td>verifyText</td><td>id=address-error<datalist><option>id=address-error</option><option>//label[@id='address-error']</option><option>//form[@id='infoForm']/div[5]/div/label</option><option>//div[5]/div/label</option><option>css=#address-error</option></datalist></td><td>regex:.*required\\.</td>\n" +
        "  </tr>\n" +
        "  </tbody></table>\n" +
        "</body>\n" +
        "</html>",
},
{
    testSuiteName: "if…elseif…else…endif",
    projectName: "Conditional cases",
    description: "Click and interact differently based on some conditions of the page",
    testSuite: `<?xml version="1.0" encoding="UTF-8"?>
<!DOCTYPE html PUBLIC "-//W3C//DTD XHTML 1.0 Strict//EN" "http://www.w3.org/TR/xhtml1/DTD/xhtml1-strict.dtd">
<html xmlns="http://www.w3.org/1999/xhtml" xml:lang="en" lang="en">
<head>
  <meta content="text/html; charset=UTF-8" http-equiv="content-type" />
  <title>if...elseIf...else...endIf</title>
</head>
<body>
<table cellpadding="1" cellspacing="1" border="1">
  <thead>
  <tr><td rowspan="1" colspan="3">if...elseIf...else...endIf</td></tr>
  </thead>
  <tbody>
  <tr><td>open</td><td>https://katalon-test.s3.amazonaws.com/aut/html/form.html<datalist><option>https://katalon-test.s3.amazonaws.com/aut/html/form.html</option></datalist></td><td></td>
  </tr>
  <tr><td>storeEval</td><td>1<datalist><option>1</option></datalist></td><td>i</td>
  </tr>
  <tr><td>if</td><td>i==1<datalist><option>i==2</option><option>i==1</option></datalist></td><td></td>
  </tr>
  <tr><td>click</td><td>id=first-name<datalist><option>id=first-name</option><option>name=firstName</option><option>//input[@id='first-name']</option><option>//form[@id='infoForm']/div/div/input</option><option>//input</option><option>css=#first-name</option></datalist></td><td></td>
  </tr>
  <tr><td>type</td><td>id=first-name<datalist><option>id=first-name</option><option>name=firstName</option><option>//input[@id='first-name']</option><option>//form[@id='infoForm']/div/div/input</option><option>//input</option><option>css=#first-name</option></datalist></td><td>Alex1</td>
  </tr>
  <tr><td>else</td><td><datalist><option>i==1</option><option>i==2</option><option></option></datalist></td><td></td>
  </tr>
  <tr><td>click</td><td>id=first-name<datalist><option>id=first-name</option><option>name=firstName</option><option>//input[@id='first-name']</option><option>//form[@id='infoForm']/div/div/input</option><option>//input</option><option>css=#first-name</option></datalist></td><td></td>
  </tr>
  <tr><td>type</td><td>id=first-name<datalist><option>id=first-name</option><option>name=firstName</option><option>//input[@id='first-name']</option><option>//form[@id='infoForm']/div/div/input</option><option>//input</option><option>css=#first-name</option></datalist></td><td>This block will be skipped.</td>
  </tr>
  <tr><td>endIf</td><td><datalist><option></option></datalist></td><td></td>
  </tr>
  <tr><td>if</td><td>i==2<datalist><option>i==1</option><option>i==2</option></datalist></td><td></td>
  </tr>
  <tr><td>click</td><td>id=first-name<datalist><option>id=first-name</option><option>name=firstName</option><option>//input[@id='first-name']</option><option>//form[@id='infoForm']/div/div/input</option><option>//input</option><option>css=#first-name</option></datalist></td><td></td>
  </tr>
  <tr><td>type</td><td>id=first-name<datalist><option>id=first-name</option><option>name=firstName</option><option>//input[@id='first-name']</option><option>//form[@id='infoForm']/div/div/input</option><option>//input</option><option>css=#first-name</option></datalist></td><td>Alex2</td>
  </tr>
  <tr><td>endIf</td><td><datalist><option></option></datalist></td><td></td>
  </tr>
  <tr><td>if</td><td>i==3<datalist><option>i==2</option><option>i==1</option><option>i==3</option></datalist></td><td></td>
  </tr>
  <tr><td>click</td><td>id=last-name<datalist><option>id=last-name</option><option>name=lastName</option><option>//input[@id='last-name']</option><option>//form[@id='infoForm']/div[2]/div/input</option><option>//div[2]/div/input</option><option>css=#last-name</option></datalist></td><td></td>
  </tr>
  <tr><td>type</td><td>id=last-name<datalist><option>id=last-name</option><option>name=lastName</option><option>//input[@id='last-name']</option><option>//form[@id='infoForm']/div[2]/div/input</option><option>//div[2]/div/input</option><option>css=#last-name</option></datalist></td><td>Smith3</td>
  </tr>
  <tr><td>elseIf</td><td>i==2<datalist><option>i==2</option></datalist></td><td></td>
  </tr>
  <tr><td>click</td><td>id=last-name<datalist><option>id=last-name</option><option>name=lastName</option><option>//input[@id='last-name']</option><option>//form[@id='infoForm']/div[2]/div/input</option><option>//div[2]/div/input</option><option>css=#last-name</option></datalist></td><td></td>
  </tr>
  <tr><td>type</td><td>id=last-name<datalist><option>id=last-name</option><option>name=lastName</option><option>//input[@id='last-name']</option><option>//form[@id='infoForm']/div[2]/div/input</option><option>//div[2]/div/input</option><option>css=#last-name</option></datalist></td><td>Smith2</td>
  </tr>
  <tr><td>else</td><td><datalist><option></option></datalist></td><td></td>
  </tr>
  <tr><td>click</td><td>id=last-name<datalist><option>id=last-name</option><option>name=lastName</option><option>//input[@id='last-name']</option><option>//form[@id='infoForm']/div[2]/div/input</option><option>//div[2]/div/input</option><option>css=#last-name</option></datalist></td><td></td>
  </tr>
  <tr><td>type</td><td>id=last-name<datalist><option>id=last-name</option><option>name=lastName</option><option>//input[@id='last-name']</option><option>//form[@id='infoForm']/div[2]/div/input</option><option>//div[2]/div/input</option><option>css=#last-name</option></datalist></td><td>Smith</td>
  </tr>
  <tr><td>endIf</td><td><datalist><option></option></datalist></td><td></td>
  </tr>
  </tbody></table>
</body>
</html>`,
},
{
    testSuiteName: "while…endwhile",
    projectName: "Repeat similar actions",
    description: "Perform actions repeatedly until a condition is met",
    testSuite: "<?xml version=\"1.0\" encoding=\"UTF-8\"?>\n" +
        "<!DOCTYPE html PUBLIC \"-//W3C//DTD XHTML 1.0 Strict//EN\" \"http://www.w3.org/TR/xhtml1/DTD/xhtml1-strict.dtd\">\n" +
        "<html xmlns=\"http://www.w3.org/1999/xhtml\" xml:lang=\"en\" lang=\"en\">\n" +
        "<head>\n" +
        "  <meta content=\"text/html; charset=UTF-8\" http-equiv=\"content-type\" />\n" +
        "  <title>while...endWhile</title>\n" +
        "</head>\n" +
        "<body>\n" +
        "<table cellpadding=\"1\" cellspacing=\"1\" border=\"1\">\n" +
        "  <thead>\n" +
        "  <tr><td rowspan=\"1\" colspan=\"3\">while...endWhile</td></tr>\n" +
        "  </thead>\n" +
        "  <tbody>\n" +
        "  <tr><td>open</td><td>https://katalon-test.s3.amazonaws.com/aut/html/form.html<datalist><option>https://katalon-test.s3.amazonaws.com/aut/html/form.html</option></datalist></td><td></td>\n" +
        "  </tr>\n" +
        "  <tr><td>store</td><td>1<datalist><option>1</option></datalist></td><td>ii</td>\n" +
        "  </tr>\n" +
        "  <tr><td>while</td><td>ii&lt;5<datalist><option>i==2</option><option>i==1</option><option>i&lt;10</option><option>ii&lt;10</option><option>ii&lt;5</option></datalist></td><td></td>\n" +
        "  </tr>\n" +
        "  <tr><td>click</td><td>id=first-name<datalist><option>id=first-name</option><option>name=firstName</option><option>//input[@id='first-name']</option><option>//form[@id='infoForm']/div/div/input</option><option>//input</option><option>css=#first-name</option></datalist></td><td></td>\n" +
        "  </tr>\n" +
        "  <tr><td>type</td><td>id=first-name<datalist><option>id=first-name</option><option>name=firstName</option><option>//input[@id='first-name']</option><option>//form[@id='infoForm']/div/div/input</option><option>//input</option><option>css=#first-name</option></datalist></td><td>${ii}</td>\n" +
        "  </tr>\n" +
        "  <tr><td>storeEval</td><td>${ii}+1<datalist><option>i+1</option><option>ii+1</option><option>${ii}+1</option></datalist></td><td>ii</td>\n" +
        "  </tr>\n" +
        "  <tr><td>endWhile</td><td><datalist><option></option></datalist></td><td></td>\n" +
        "  </tr>\n" +
        "  </tbody></table>\n" +
        "</body>\n" +
        "</html>",
},
{
    testSuiteName: "Nested loops",
    projectName: "Repeat actions on similar pages",
    description: "Go over a number of similar pages and interact with the elements on these pages in similar ways",
    testSuite: "<?xml version=\"1.0\" encoding=\"UTF-8\"?>\n" +
        "<!DOCTYPE html PUBLIC \"-//W3C//DTD XHTML 1.0 Strict//EN\" \"http://www.w3.org/TR/xhtml1/DTD/xhtml1-strict.dtd\">\n" +
        "<html xmlns=\"http://www.w3.org/1999/xhtml\" xml:lang=\"en\" lang=\"en\">\n" +
        "<head>\n" +
        "  <meta content=\"text/html; charset=UTF-8\" http-equiv=\"content-type\" />\n" +
        "  <title>Nested loops</title>\n" +
        "</head>\n" +
        "<body>\n" +
        "<table cellpadding=\"1\" cellspacing=\"1\" border=\"1\">\n" +
        "  <thead>\n" +
        "  <tr><td rowspan=\"1\" colspan=\"3\">Nested loops</td></tr>\n" +
        "  </thead>\n" +
        "  <tbody>\n" +
        "  <tr><td>storeEval</td><td>5<datalist><option>10</option><option>2</option><option>5</option></datalist></td><td>pages</td>\n" +
        "  </tr>\n" +
        "  <tr><td>storeEval</td><td>1<datalist><option>1</option></datalist></td><td>pageIndex</td>\n" +
        "  </tr>\n" +
        "  <tr><td>while</td><td>${pageIndex}&lt;${pages}<datalist><option>${pageIndex}&lt;${pages}</option><option>pageIndex&lt;pages</option></datalist></td><td></td>\n" +
        "  </tr>\n" +
        "  <tr><td>storeEval</td><td>${pageIndex} + 1<datalist><option>${pageIndex} + 1</option></datalist></td><td>pageIndex</td>\n" +
        "  </tr>\n" +
        "  <tr><td>store</td><td>page_${pageIndex}<datalist><option>page_${pageIndex}</option></datalist></td><td>url</td>\n" +
        "  </tr>\n" +
        "  <tr><td>store</td><td>5<datalist><option>10</option><option>5</option></datalist></td><td>rows</td>\n" +
        "  </tr>\n" +
        "  <tr><td>store</td><td>0<datalist><option>0</option></datalist></td><td>rowIndex</td>\n" +
        "  </tr>\n" +
        "  <tr><td>while</td><td>${rowIndex}&lt;${rows}<datalist><option>${rowIndex}&lt;${rows}</option><option>rowIndex&lt;rows</option></datalist></td><td></td>\n" +
        "  </tr>\n" +
        "  <tr><td>storeEval</td><td>${rowIndex} + 1<datalist><option>${rowIndex} + 1</option></datalist></td><td>rowIndex</td>\n" +
        "  </tr>\n" +
        "  <tr><td>store</td><td>click_${rowIndex}<datalist><option>click_${rowIndex}</option></datalist></td><td>click</td>\n" +
        "  </tr>\n" +
        "  <tr><td>endWhile</td><td><datalist><option></option></datalist></td><td></td>\n" +
        "  </tr>\n" +
        "  <tr><td>endWhile</td><td><datalist><option></option></datalist></td><td></td>\n" +
        "  </tr>\n" +
        "  </tbody></table>\n" +
        "</body>\n" +
        "</html>",
},
{
    testSuiteName: "gotoIf…gotoLabel…label",
    projectName: "Reuse actions in your automation scripts",
    description: "Run a particular part of your automation scripts when needed",
    testSuite: "<?xml version=\"1.0\" encoding=\"UTF-8\"?>\n" +
        "<!DOCTYPE html PUBLIC \"-//W3C//DTD XHTML 1.0 Strict//EN\" \"http://www.w3.org/TR/xhtml1/DTD/xhtml1-strict.dtd\">\n" +
        "<html xmlns=\"http://www.w3.org/1999/xhtml\" xml:lang=\"en\" lang=\"en\">\n" +
        "<head>\n" +
        "  <meta content=\"text/html; charset=UTF-8\" http-equiv=\"content-type\" />\n" +
        "  <title>gotoIf...gotoLabel...label</title>\n" +
        "</head>\n" +
        "<body>\n" +
        "<table cellpadding=\"1\" cellspacing=\"1\" border=\"1\">\n" +
        "  <thead>\n" +
        "  <tr><td rowspan=\"1\" colspan=\"3\">gotoIf...gotoLabel...label</td></tr>\n" +
        "  </thead>\n" +
        "  <tbody>\n" +
        "  <tr><td>open</td><td>https://katalon-test.s3.amazonaws.com/aut/html/form.html<datalist><option>https://katalon-test.s3.amazonaws.com/aut/html/form.html</option></datalist></td><td></td>\n" +
        "  </tr>\n" +
        "  <tr><td>store</td><td>1<datalist><option>0</option><option>1</option></datalist></td><td>j</td>\n" +
        "  </tr>\n" +
        "  <tr><td>label</td><td>COMMENT<datalist><option>COMMENT</option></datalist></td><td></td>\n" +
        "  </tr>\n" +
        "  <tr><td>type</td><td>id=comment<datalist><option>id=comment</option><option>name=comment</option><option>//textarea[@id='comment']</option><option>//form[@id='infoForm']/div[12]/div/textarea</option><option>//textarea</option><option>css=#comment</option></datalist></td><td>${j}</td>\n" +
        "  </tr>\n" +
        "  <tr><td>storeEval</td><td>${j}+1<datalist><option>i+1</option><option>j+1</option><option>${j}+1</option></datalist></td><td>j</td>\n" +
        "  </tr>\n" +
        "  <tr><td>gotoIf</td><td>j &lt; 3<datalist><option>i &lt; 3</option><option>j &lt; 3</option></datalist></td><td>COMMENT</td>\n" +
        "  </tr>\n" +
        "  <tr><td>gotoLabel</td><td>END<datalist><option>END</option></datalist></td><td></td>\n" +
        "  </tr>\n" +
        "  <tr><td>type</td><td>id=comment<datalist><option>id=comment</option></datalist></td><td>skipped</td>\n" +
        "  </tr>\n" +
        "  <tr><td>label</td><td>END<datalist><option>END</option></datalist></td><td></td>\n" +
        "  </tr>\n" +
        "  <tr><td>type</td><td>id=comment<datalist><option>id=comment</option></datalist></td><td>end</td>\n" +
        "  </tr>\n" +
        "  </tbody></table>\n" +
        "</body>\n" +
        "</html>",
},
{
    testSuiteName: "Test Data",
    projectName: "Fill a form with data from CSV file with Sample Test Data ",
    description: "Read data from a CSV and type all of them into a page",
    testSuite: "<?xml version=\"1.0\" encoding=\"UTF-8\"?>\n" +
        "<!DOCTYPE html PUBLIC \"-//W3C//DTD XHTML 1.0 Strict//EN\" \"http://www.w3.org/TR/xhtml1/DTD/xhtml1-strict.dtd\">\n" +
        "<html xmlns=\"http://www.w3.org/1999/xhtml\" xml:lang=\"en\" lang=\"en\">\n" +
        "<head>\n" +
        "  <meta content=\"text/html; charset=UTF-8\" http-equiv=\"content-type\" />\n" +
        "  <title>Test Data</title>\n" +
        "</head>\n" +
        "<body>\n" +
        "<table cellpadding=\"1\" cellspacing=\"1\" border=\"1\">\n" +
        "  <thead>\n" +
        "  <tr><td rowspan=\"1\" colspan=\"3\">Test Data</td></tr>\n" +
        "  </thead>\n" +
        "  <tbody>\n" +
        "  <tr><td>loadVars</td><td>data.csv<datalist><option>workplace-team.csv</option><option>data.csv</option></datalist></td><td></td>\n" +
        "  </tr>\n" +
        "  <tr><td>open</td><td>https://katalon-test.s3.amazonaws.com/aut/html/form.html<datalist><option>https://katalon-test.s3.amazonaws.com/aut/html/form.html</option></datalist></td><td></td>\n" +
        "  </tr>\n" +
        "  <tr><td>type</td><td>id=first-name<datalist><option>id=first-name</option><option>name=firstName</option><option>//input[@id='first-name']</option><option>//form[@id='infoForm']/div/div/input</option><option>//input</option><option>css=#first-name</option></datalist></td><td>${first}</td>\n" +
        "  </tr>\n" +
        "  <tr><td>type</td><td>id=last-name<datalist><option>id=last-name</option><option>name=lastName</option><option>//input[@id='last-name']</option><option>//form[@id='infoForm']/div[2]/div/input</option><option>//div[2]/div/input</option><option>css=#last-name</option></datalist></td><td>${last}</td>\n" +
        "  </tr>\n" +
        "  <tr><td>endLoadVars</td><td><datalist><option></option></datalist></td><td></td>\n" +
        "  </tr>\n" +
        "  <tr><td>storeCsv</td><td>data.csv,1,last<datalist><option>data.csv,1,last</option></datalist></td><td>last</td>\n" +
        "  </tr>\n" +
        "  <tr><td>echo</td><td>${last}<datalist><option>${last}</option></datalist></td><td></td>\n" +
        "  </tr>\n" +
        "  </tbody></table>\n" +
        "</body>\n" +
        "</html>",
    data: {
        "data.csv": {
            "content": "first,last\nAlex,Smith\nSteve,Rogers\nBruce,Wayne",
            "type": "csv"
        }
    }
},
{
    testSuiteName: "Verify vs Assert",
    projectName: "Stop when field values are unexpected",
    description: "Verify field values and stop execution if invalid.",
    testSuite: "<?xml version=\"1.0\" encoding=\"UTF-8\"?>\n" +
        "<!DOCTYPE html PUBLIC \"-//W3C//DTD XHTML 1.0 Strict//EN\" \"http://www.w3.org/TR/xhtml1/DTD/xhtml1-strict.dtd\">\n" +
        "<html xmlns=\"http://www.w3.org/1999/xhtml\" xml:lang=\"en\" lang=\"en\">\n" +
        "<head>\n" +
        "  <meta content=\"text/html; charset=UTF-8\" http-equiv=\"content-type\" />\n" +
        "  <title>Verify vs Assert</title>\n" +
        "</head>\n" +
        "<body>\n" +
        "<table cellpadding=\"1\" cellspacing=\"1\" border=\"1\">\n" +
        "  <thead>\n" +
        "  <tr><td rowspan=\"1\" colspan=\"3\">Verify vs Assert</td></tr>\n" +
        "  </thead>\n" +
        "  <tbody>\n" +
        "  <tr><td>open</td><td>https://katalon-test.s3.amazonaws.com/aut/html/form.html<datalist><option>https://katalon-test.s3.amazonaws.com/aut/html/form.html</option></datalist></td><td></td>\n" +
        "  </tr>\n" +
        "  <tr><td>click</td><td>id=first-name<datalist><option>id=first-name</option><option>name=firstName</option><option>//input[@id='first-name']</option><option>//form[@id='infoForm']/div/div/input</option><option>//input</option><option>css=#first-name</option></datalist></td><td></td>\n" +
        "  </tr>\n" +
        "  <tr><td>type</td><td>id=first-name<datalist><option>id=first-name</option><option>name=firstName</option><option>//input[@id='first-name']</option><option>//form[@id='infoForm']/div/div/input</option><option>//input</option><option>css=#first-name</option></datalist></td><td>Alex</td>\n" +
        "  </tr>\n" +
        "  <tr><td>click</td><td>id=last-name<datalist><option>id=last-name</option><option>name=lastName</option><option>//input[@id='last-name']</option><option>//form[@id='infoForm']/div[2]/div/input</option><option>//div[2]/div/input</option><option>css=#last-name</option></datalist></td><td></td>\n" +
        "  </tr>\n" +
        "  <tr><td>type</td><td>id=last-name<datalist><option>id=last-name</option><option>name=lastName</option><option>//input[@id='last-name']</option><option>//form[@id='infoForm']/div[2]/div/input</option><option>//div[2]/div/input</option><option>css=#last-name</option></datalist></td><td>Smith</td>\n" +
        "  </tr>\n" +
        "  <tr><td>click</td><td>id=submit<datalist><option>id=submit</option><option>//button[@id='submit']</option><option>//form[@id='infoForm']/div[13]/div/button</option><option>//button</option><option>css=#submit</option></datalist></td><td></td>\n" +
        "  </tr>\n" +
        "  <tr><td>verifyText</td><td>id=gender-error<datalist><option>id=gender-error</option><option>//label[@id='gender-error']</option><option>//form[@id='infoForm']/div[3]/div/label</option><option>//div[3]/div/label</option><option>css=#gender-error</option></datalist></td><td>Execution will continue after this check.</td>\n" +
        "  </tr>\n" +
        "  <tr><td>assertText</td><td>id=gender-error<datalist><option>id=gender-error</option><option>//label[@id='gender-error']</option><option>//form[@id='infoForm']/div[3]/div/label</option><option>//div[3]/div/label</option><option>css=#gender-error</option></datalist></td><td>Execution will stop after this check.</td>\n" +
        "  </tr>\n" +
        "  <tr><td>verifyText</td><td>id=gender-error<datalist><option>id=gender-error</option><option>//label[@id='gender-error']</option><option>//form[@id='infoForm']/div[3]/div/label</option><option>//div[3]/div/label</option><option>css=#gender-error</option></datalist></td><td>This step will not execute.</td>\n" +
        "  </tr>\n" +
        "  </tbody></table>\n" +
        "</body>\n" +
        "</html>",
},
{
    testSuiteName: "waitFor…",
    projectName: "Wait patiently",
    description: "Wait for an element to be present",
    testSuite: "<?xml version=\"1.0\" encoding=\"UTF-8\"?>\n" +
        "<!DOCTYPE html PUBLIC \"-//W3C//DTD XHTML 1.0 Strict//EN\" \"http://www.w3.org/TR/xhtml1/DTD/xhtml1-strict.dtd\">\n" +
        "<html xmlns=\"http://www.w3.org/1999/xhtml\" xml:lang=\"en\" lang=\"en\">\n" +
        "<head>\n" +
        "  <meta content=\"text/html; charset=UTF-8\" http-equiv=\"content-type\" />\n" +
        "  <title>waitFor...</title>\n" +
        "</head>\n" +
        "<body>\n" +
        "<table cellpadding=\"1\" cellspacing=\"1\" border=\"1\">\n" +
        "  <thead>\n" +
        "  <tr><td rowspan=\"1\" colspan=\"3\">waitFor...</td></tr>\n" +
        "  </thead>\n" +
        "  <tbody>\n" +
        "  <tr><td>open</td><td>https://katalon-test.s3.amazonaws.com/aut/html/delay.html<datalist><option>https://katalon-test.s3.amazonaws.com/aut/html/delay.html</option></datalist></td><td></td>\n" +
        "  </tr>\n" +
        "  <tr><td>waitForElementPresent</td><td>id=waitedForElement<datalist><option>id=waitedForElement</option><option>//div[@id='waitedForElement']</option><option>//div[@id='container']/div</option><option>//div[2]/div</option><option>css=#waitedForElement</option></datalist></td><td></td>\n" +
        "  </tr>\n" +
        "  <tr><td>echo</td><td>Done!<datalist><option>Done!</option></datalist></td><td></td>\n" +
        "  </tr>\n" +
        "  </tbody></table>\n" +
        "</body>\n" +
        "</html>",
},
{
    testSuiteName: "waitFor…wisthCustomTimeout",
    projectName: "Wait impatiently",
    description: "Wait for an element to be present only within some seconds",
    testSuite: "<?xml version=\"1.0\" encoding=\"UTF-8\"?>\n" +
        "<!DOCTYPE html PUBLIC \"-//W3C//DTD XHTML 1.0 Strict//EN\" \"http://www.w3.org/TR/xhtml1/DTD/xhtml1-strict.dtd\">\n" +
        "<html xmlns=\"http://www.w3.org/1999/xhtml\" xml:lang=\"en\" lang=\"en\">\n" +
        "<head>\n" +
        "  <meta content=\"text/html; charset=UTF-8\" http-equiv=\"content-type\" />\n" +
        "  <title>waitFor... with custom timeout</title>\n" +
        "</head>\n" +
        "<body>\n" +
        "<table cellpadding=\"1\" cellspacing=\"1\" border=\"1\">\n" +
        "  <thead>\n" +
        "  <tr><td rowspan=\"1\" colspan=\"3\">waitFor... with custom timeout</td></tr>\n" +
        "  </thead>\n" +
        "  <tbody>\n" +
        "  <tr><td>open</td><td>https://katalon-test.s3.amazonaws.com/aut/html/delay.html<datalist><option>https://katalon-test.s3.amazonaws.com/aut/html/delay.html</option></datalist></td><td></td>\n" +
        "  </tr>\n" +
        "  <tr><td>#</td><td>The element will show up in 10 seconds, but we only wait 2 seconds<datalist><option>The element will show up in 10 seconds, but we only wait 2 seconds</option></datalist></td><td></td>\n" +
        "  </tr>\n" +
        "  <tr><td>setTimeout</td><td>2000<datalist><option>2000</option></datalist></td><td></td>\n" +
        "  </tr>\n" +
        "  <tr><td>waitForElementPresent</td><td>id=waitedForElement<datalist><option>id=waitedForElement</option><option>//div[@id='waitedForElement']</option><option>//div[@id='container']/div</option><option>//div[2]/div</option><option>css=#waitedForElement</option></datalist></td><td></td>\n" +
        "  </tr>\n" +
        "  <tr><td>echo</td><td>Done!<datalist><option>Done!</option></datalist></td><td></td>\n" +
        "  </tr>\n" +
        "  </tbody></table>\n" +
        "</body>\n" +
        "</html>",
},
{
    testSuiteName: "Delay",
    projectName: "Pause",
    description: "Pause for 5 seconds and then continue",
    testSuite: "<?xml version=\"1.0\" encoding=\"UTF-8\"?>\n" +
        "<!DOCTYPE html PUBLIC \"-//W3C//DTD XHTML 1.0 Strict//EN\" \"http://www.w3.org/TR/xhtml1/DTD/xhtml1-strict.dtd\">\n" +
        "<html xmlns=\"http://www.w3.org/1999/xhtml\" xml:lang=\"en\" lang=\"en\">\n" +
        "<head>\n" +
        "  <meta content=\"text/html; charset=UTF-8\" http-equiv=\"content-type\" />\n" +
        "  <title>Delay</title>\n" +
        "</head>\n" +
        "<body>\n" +
        "<table cellpadding=\"1\" cellspacing=\"1\" border=\"1\">\n" +
        "  <thead>\n" +
        "  <tr><td rowspan=\"1\" colspan=\"3\">Delay</td></tr>\n" +
        "  </thead>\n" +
        "  <tbody>\n" +
        "  <tr><td>open</td><td>https://katalon-test.s3.amazonaws.com/aut/html/form.html<datalist><option>https://katalon-test.s3.amazonaws.com/aut/html/form.html</option></datalist></td><td></td>\n" +
        "  </tr>\n" +
        "  <tr><td>echo</td><td>1<datalist><option>1</option></datalist></td><td></td>\n" +
        "  </tr>\n" +
        "  <tr><td>pause</td><td>5000<datalist><option>10000</option><option>5000</option></datalist></td><td></td>\n" +
        "  </tr>\n" +
        "  <tr><td>echo</td><td>2<datalist><option>2</option></datalist></td><td></td>\n" +
        "  </tr>\n" +
        "  </tbody></table>\n" +
        "</body>\n" +
        "</html>",
},
{
    testSuiteName: "storeCSV sample",
    projectName: "Read and use values from a CSV file with Sample Test Data.",
    description: "Read the number of lines, a value at a particular row and column, compute values from different cells. ",
    testSuite: "<?xml version=\"1.0\" encoding=\"UTF-8\"?>\n" +
        "<!DOCTYPE html PUBLIC \"-//W3C//DTD XHTML 1.0 Strict//EN\" \"http://www.w3.org/TR/xhtml1/DTD/xhtml1-strict.dtd\">\n" +
        "<html xmlns=\"http://www.w3.org/1999/xhtml\" xml:lang=\"en\" lang=\"en\">\n" +
        "<head>\n" +
        "\t<meta content=\"text/html; charset=UTF-8\" http-equiv=\"content-type\" />\n" +
        "\t<title>storeCSV sample</title>\n" +
        "</head>\n" +
        "<body>\n" +
        "<table cellpadding=\"1\" cellspacing=\"1\" border=\"1\">\n" +
        "<thead>\n" +
        "<tr><td rowspan=\"1\" colspan=\"3\">storeCSV sample</td></tr>\n" +
        "</thead>\n" +
        "<tbody>\n" +
        "<tr><td>storeCsv</td><td>data.csv,0,first<datalist><option>data.csv,2,firstName</option><option>data.csv,0,firstName</option><option>data.csv,0,first</option></datalist></td><td>firstName</td>\n" +
        "</tr>\n" +
        "<tr><td>echo</td><td>${firstName}<datalist><option>${firstName}</option></datalist></td><td></td>\n" +
        "</tr>\n" +
        "<tr><td>storeCsv</td><td>data.csv<datalist><option>data.csv,0,first</option><option>data.csv,2,firstName</option><option>data.csv,0,firstName</option><option>data.csv</option></datalist></td><td>dataCSV</td>\n" +
        "</tr>\n" +
        "<tr><td>storeEval</td><td>dataCSV.length<datalist><option>data.csv,0,first</option><option>data.csv,2,firstName</option><option>data.csv,0,firstName</option><option>dataCSV.length</option></datalist></td><td>dataLength</td>\n" +
        "</tr>\n" +
        "<tr><td>echo</td><td>${dataLength}<datalist><option>dataLength</option><option>${dataLength}</option></datalist></td><td></td>\n" +
        "</tr>\n" +
        "<tr><td>storeEval</td><td>dataCSV[\"first\"][0]<datalist><option>dataCsv[\"first\"][0]</option><option>dataCSV[\"first\"][0]</option></datalist></td><td>firstName</td>\n" +
        "</tr>\n" +
        "<tr><td>echo</td><td>${firstName}<datalist><option>firstName</option><option>${firstName}</option></datalist></td><td></td>\n" +
        "</tr>\n" +
        "<tr><td>storeEval</td><td>dataCSV[\"first\"][0] + dataCSV[\"last\"][0]<datalist><option>dataCSV[\"first\"][0] + dataCSV[\"last\"][0]</option></datalist></td><td>fullName</td>\n" +
        "</tr>\n" +
        "<tr><td>echo</td><td>fullName<datalist><option>fullName</option></datalist></td><td></td>\n" +
        "</tr>\n" +
        "<tr><td>store</td><td>0<datalist><option>fullName</option><option>3</option><option>0</option></datalist></td><td>i</td>\n" +
        "</tr>\n" +
        "<tr><td>storeEval</td><td>dataCSV[\"first\"][${i}] + dataCSV[\"last\"][${i}]<datalist><option>dataCSV[\"first\"][0] + dataCSV[\"last\"][0]</option><option>dataCSV[\"first\"][${i}] + dataCSV[\"last\"][${i}]</option></datalist></td><td>fullName</td>\n" +
        "</tr>\n" +
        "<tr><td>echo</td><td>${fullName}<datalist><option>fullName</option><option>${fullName}</option></datalist></td><td></td>\n" +
        "</tr>\n" +
        "</tbody></table>\n" +
        "</body>\n" +
        "</html>",
    data: {
        "data.csv": {
            "content": "first,last\nAlex,Smith\nSteve,Rogers\nBruce,Wayne",
            "type": "csv"
        }
    }
},
{
    testSuiteName: "Upload a file with drag and drop",
    projectName: "Upload a file with drag and drop.",
    description: "How to upload a file to a website that supports drag and drop easily (Chrome only).",
    testSuite: "<?xml version=\"1.0\" encoding=\"UTF-8\"?>\n" +
        "<!DOCTYPE html PUBLIC \"-//W3C//DTD XHTML 1.0 Strict//EN\" \"http://www.w3.org/TR/xhtml1/DTD/xhtml1-strict.dtd\">\n" +
        "<html xmlns=\"http://www.w3.org/1999/xhtml\" xml:lang=\"en\" lang=\"en\">\n" +
        "<head>\n" +
        "\t<meta content=\"text/html; charset=UTF-8\" http-equiv=\"content-type\" />\n" +
        "\t<title>Upload a file with drag and drop</title>\n" +
        "</head>\n" +
        "<body>\n" +
        "<table cellpadding=\"1\" cellspacing=\"1\" border=\"1\">\n" +
        "<thead>\n" +
        "<tr><td rowspan=\"1\" colspan=\"3\">Upload 1 file</td></tr>\n" +
        "</thead>\n" +
        "<tbody>\n" +
        "<tr><td>open</td><td>https://imgur.com/upload?beta<datalist><option>https://imgur.com/upload?beta</option></datalist></td><td></td>\n" +
        "</tr>\n" +
        "<tr><td>store</td><td><datalist><option>https://imgur.com/upload?beta</option><option>/Users/tien.truong/Downloads/Tien_Profile.jpg</option><option></option></datalist></td><td>imagePath</td>\n" +
        "</tr>\n" +
        "<tr><td>upload</td><td><datalist><option></option></datalist></td><td>${imagePath}</td>\n" +
        "</tr>\n" +
        "<tr><td>waitForElementPresent</td><td>css=button.Button.Button-hidden.isActive<datalist><option>xpath=//div[@id='root']/div/div/div/div[4]/div[2]/div/div/div[2]/button[2]</option><option>xpath=(.//*[normalize-space(text()) and normalize-space(.)='To Community'])[1]/following::button[1]</option><option>xpath=(.//!*[normalize-space(text()) and normalize-space(.)='Post'])[1]/following::button[2]</option><option>xpath=//div[2]/button[2]</option><option>css=button.Button.Button-hidden.isActive</option></datalist></td><td></td>\n" +
        "</tr>\n" +
        "</tbody>",
},
{
    testSuiteName: "Write values to a CSV file",
    projectName: "Write values to a CSV file with Sample Test Data.",
    description: "Write values to a particular row and column in an existing CSV file",
    testSuite: "<?xml version=\"1.0\" encoding=\"UTF-8\"?>\n" +
        "<!DOCTYPE html PUBLIC \"-//W3C//DTD XHTML 1.0 Strict//EN\" \"http://www.w3.org/TR/xhtml1/DTD/xhtml1-strict.dtd\">\n" +
        "<html xmlns=\"http://www.w3.org/1999/xhtml\" xml:lang=\"en\" lang=\"en\">\n" +
        "<head>\n" +
        "\t<meta content=\"text/html; charset=UTF-8\" http-equiv=\"content-type\" />\n" +
        "\t<title>Write values to a CSV file</title>\n" +
        "</head>\n" +
        "<body>\n" +
        "<table cellpadding=\"1\" cellspacing=\"1\" border=\"1\">\n" +
        "<thead>\n" +
        "<tr><td rowspan=\"1\" colspan=\"3\">writeToCSV sample</td></tr>\n" +
        "</thead>\n" +
        "<tbody>\n" +
        "<tr><td>loadVars</td><td>data.csv<datalist><option>data.csv</option></datalist></td><td></td>\n" +
        "</tr>\n" +
        "<tr><td>echo</td><td>${first}  ${last}<datalist><option>${first} + \" \" ${last}</option><option>${first} + \" \" + ${last}</option><option>${first}  ${last}</option></datalist></td><td></td>\n" +
        "</tr>\n" +
        "<tr><td>endLoadVars</td><td><datalist><option></option></datalist></td><td></td>\n" +
        "</tr>\n" +
        "<tr><td>writeToCSV</td><td>data.csv,0,first<datalist><option>data.csv,0,first</option></datalist></td><td>Doctor</td>\n" +
        "</tr>\n" +
        "<tr><td>writeToCSV</td><td>data.csv,0,last<datalist><option>data.csv,0,last</option></datalist></td><td>Who</td>\n" +
        "</tr>\n" +
        "<tr><td>loadVars</td><td>data.csv<datalist><option>data.csv</option></datalist></td><td></td>\n" +
        "</tr>\n" +
        "<tr><td>echo</td><td>${first}  ${last}<datalist><option>${first} + \" \" ${last}</option><option>${first} + \" \" + ${last}</option><option>${first}  ${last}</option></datalist></td><td></td>\n" +
        "</tr>\n" +
        "<tr><td>endLoadVars</td><td><datalist><option></option></datalist></td><td></td>\n" +
        "</tr>\n" +
        "</tbody>",
    data: {
        "data.csv": {
            "content": "first,last\nAlex,Smith\nSteve,Rogers\nBruce,Wayne",
            "type": "csv"
        }
    }
},
{
    testSuiteName: "Upload image through CSV",
    projectName: "Upload images and descriptions with Sample Test Data.",
    description: "Upload a set of images and descriptions from a CSV file.",
    testSuite: "<?xml version=\"1.0\" encoding=\"UTF-8\"?>\n" +
        "<!DOCTYPE html PUBLIC \"-//W3C//DTD XHTML 1.0 Strict//EN\" \"http://www.w3.org/TR/xhtml1/DTD/xhtml1-strict.dtd\">\n" +
        "<html xmlns=\"http://www.w3.org/1999/xhtml\" xml:lang=\"en\" lang=\"en\">\n" +
        "<head>\n" +
        "\t<meta content=\"text/html; charset=UTF-8\" http-equiv=\"content-type\" />\n" +
        "\t<title>Upload images</title>\n" +
        "</head>\n" +
        "<body>\n" +
        "<table cellpadding=\"1\" cellspacing=\"1\" border=\"1\">\n" +
        "<thead>\n" +
        "<tr><td rowspan=\"1\" colspan=\"3\">Upload images to PasteBoard</td></tr>\n" +
        "</thead>\n" +
        "<tbody>\n" +
        "<tr><td>loadVars</td><td>imagePaths.csv<datalist><option>imagePaths.csv</option></datalist></td><td></td>\n" +
        "</tr>\n" +
        "<tr><td>open</td><td>https://pasteboard.co/<datalist><option>https://pasteboard.co/</option><option>https://imgur.com/upload?beta</option></datalist></td><td></td>\n" +
        "</tr>\n" +
        "<tr><td>upload</td><td><datalist><option></option></datalist></td><td>${path}</td>\n" +
        "</tr>\n" +
        "<tr><td>waitForElementPresent</td><td>xpath=(.//!*[normalize-space(text()) and normalize-space(.)='Delete'])[1]/following::button[1]<datalist><option>xpath=(.//!*[normalize-space(text()) and normalize-space(.)='Delete'])[1]/following::button[1]</option><option>xpath=(.//!*[normalize-space(text()) and normalize-space(.)='Premium'])[2]/following::button[2]</option><option>xpath=//div[6]/button[2]</option><option>css=button.confirm</option></datalist></td><td></td>\n" +
        "</tr>\n" +
        "<tr><td>click</td><td>xpath=(.//!*[normalize-space(text()) and normalize-space(.)='Delete'])[1]/following::span[1]<datalist><option>xpath=(.//!*[normalize-space(text()) and normalize-space(.)='Delete'])[1]/following::span[1]</option><option>xpath=(.//!*[normalize-space(text()) and normalize-space(.)='Premium'])[2]/following::span[1]</option><option>xpath=//!*!/text()[normalize-space(.)='Upload']/parent::*</option><option>xpath=//button[2]/span</option><option>css=button.confirm &gt; span</option></datalist></td><td></td>\n" +
        "</tr>\n" +
        "<tr><td>click</td><td>xpath=//div[2]/input<datalist><option>xpath=//div[2]/input</option><option>css=input.image-link.appear</option></datalist></td><td></td>\n" +
        "</tr>\n" +
        "<tr><td>click</td><td>id=title<datalist><option>id=title</option><option>xpath=//input[@id='title']</option><option>xpath=//div[3]/input</option><option>css=#title</option></datalist></td><td></td>\n" +
        "</tr>\n" +
        "<tr><td>type</td><td>id=title<datalist><option>id=title</option><option>xpath=//input[@id='title']</option><option>xpath=//div[3]/input</option><option>css=#title</option></datalist></td><td>${name}</td>\n" +
        "</tr>\n" +
        "<tr><td>click</td><td>xpath=//div[2]/input<datalist><option>xpath=//div[2]/input</option><option>css=input.image-link.appear</option></datalist></td><td></td>\n" +
        "</tr>\n" +
        "<tr><td>waitForValue</td><td>xpath=//div[2]/input<datalist><option>xpath=//div[2]/input</option><option>css=input.image-link.appear</option></datalist></td><td>regex:.*[https://pasteboard.co]\\.</td>\n" +
        "</tr>\n" +
        "<tr><td>storeValue</td><td>xpath=//div[2]/input<datalist><option>xpath=//div[2]/input</option><option>css=input.image-link.appear</option></datalist></td><td>image_url</td>\n" +
        "</tr>\n" +
        "<tr><td>appendToCSV</td><td>result.csv<datalist><option>imagePaths.csv</option><option>result.csv</option></datalist></td><td>${name},${path},${image_url}</td>\n" +
        "</tr>\n" +
        "<tr><td>click</td><td>xpath=(.//!*[normalize-space(text()) and normalize-space(.)='Go to image'])[1]/following::button[1]<datalist><option>xpath=(.//!*[normalize-space(text()) and normalize-space(.)='Go to image'])[1]/following::button[1]</option><option>xpath=(.//!*[normalize-space(text()) and normalize-space(.)='Cancel'])[1]/following::button[1]</option><option>xpath=//!*/text()[normalize-space(.)='Save']/parent::*</option><option>xpath=//span/button</option><option>css=span.confirm-buttons &gt; button.confirm</option></datalist></td><td></td>\n" +
        "</tr>\n" +
        "<tr><td>pause</td><td>3000<datalist><option>OK</option><option>3000</option></datalist></td><td></td>\n" +
        "</tr>\n" +
        "<tr><td>endLoadVars</td><td><datalist><option></option></datalist></td><td></td>\n" +
        "</tr>\n" +
        "</tbody></table>\n" +
        "</body>\n" +
        "</html>",
    data: {
        "imagePaths.csv": {
            "content": "name,description,path\n" +
                "image_1,description_1,/absolute/path/to/your/file\n" +
                "image_2,description_2,/absolute/path/to/your/file\n" +
                "image_3,description_3,/absolute/path/to/your/file",
            "type": "csv"
        },
        "result.csv": {
            "content": "name,path,image_url",
            "type": "csv"
        }
    }
},
{
    testSuiteName: "Append new rows to a CSV file",
    projectName: "Append new rows to a CSV file with Sample Test Data.",
    description: "Add new rows without specifying rows and columns to an existing CSV File.",
    testSuite: "<?xml version=\"1.0\" encoding=\"UTF-8\"?>\n" +
        "<!DOCTYPE html PUBLIC \"-//W3C//DTD XHTML 1.0 Strict//EN\" \"http://www.w3.org/TR/xhtml1/DTD/xhtml1-strict.dtd\">\n" +
        "<html xmlns=\"http://www.w3.org/1999/xhtml\" xml:lang=\"en\" lang=\"en\">\n" +
        "<head>\n" +
        "\t<meta content=\"text/html; charset=UTF-8\" http-equiv=\"content-type\" />\n" +
        "\t<title>CSV manipulation</title>\n" +
        "</table>\n" +
        "<table cellpadding=\"1\" cellspacing=\"1\" border=\"1\">\n" +
        "<thead>\n" +
        "<tr><td rowspan=\"1\" colspan=\"3\">appendToCSV sample</td></tr>\n" +
        "</thead>\n" +
        "<tbody>\n" +
        "<tr><td>loadVars</td><td>data.csv<datalist><option>data.csv</option></datalist></td><td></td>\n" +
        "</tr>\n" +
        "<tr><td>echo</td><td>${first} ${last}<datalist><option>${first} + \" \" ${last}</option><option>${first} + \" \" + ${last}</option><option>${first} ${last}</option></datalist></td><td></td>\n" +
        "</tr>\n" +
        "<tr><td>endLoadVars</td><td><datalist><option></option></datalist></td><td></td>\n" +
        "</tr>\n" +
        "<tr><td>appendToCSV</td><td>data.csv<datalist><option>data.csv,0,first</option><option>data.csv</option></datalist></td><td>Sam,Smith</td>\n" +
        "</tr>\n" +
        "<tr><td>loadVars</td><td>data.csv<datalist><option>data.csv</option></datalist></td><td></td>\n" +
        "</tr>\n" +
        "<tr><td>echo</td><td>${first} ${last}<datalist><option>${first} + \" \" ${last}</option><option>${first} + \" \" + ${last}</option><option>${first} ${last}</option></datalist></td><td></td>\n" +
        "</tr>\n" +
        "<tr><td>endLoadVars</td><td><datalist><option></option></datalist></td><td></td>\n" +
        "</tr>\n" +
        "</tbody></table>\n" +
        "</body>\n" +
        "</html>",
    data: {
        "data.csv": {
            "content": "first,last\nAlex,Smith\nSteve,Rogers\nBruce,Wayne",
            "type": "csv"
        }
    }
},
{
    testSuiteName: "Upload multiple files with drag and drop",
    projectName: "Upload multiple files with drag and drop.",
    description: "How to upload multiple files to a website that supports drag and drop easily (Chrome only).",
    testSuite: "<?xml version=\"1.0\" encoding=\"UTF-8\"?>\n" +
        "<!DOCTYPE html PUBLIC \"-//W3C//DTD XHTML 1.0 Strict//EN\" \"http://www.w3.org/TR/xhtml1/DTD/xhtml1-strict.dtd\">\n" +
        "<html xmlns=\"http://www.w3.org/1999/xhtml\" xml:lang=\"en\" lang=\"en\">\n" +
        "<head>\n" +
        "\t<meta content=\"text/html; charset=UTF-8\" http-equiv=\"content-type\" />\n" +
        "\t<title>Upload multiple files with drag and drop</title>\n" +
        "</head>\n" +
        "<body>\n" +
        "</table>\n" +
        "<table cellpadding=\"1\" cellspacing=\"1\" border=\"1\">\n" +
        "<thead>\n" +
        "<tr><td rowspan=\"1\" colspan=\"3\">Upload multiple files</td></tr>\n" +
        "</thead>\n" +
        "<tbody>\n" +
        "<tr><td>open</td><td>https://imgur.com/upload?beta<datalist><option>https://imgur.com/upload?beta</option></datalist></td><td></td>\n" +
        "</tr>\n" +
        "<tr><td>store</td><td><datalist><option>/Users/tien.truong/Downloads/Tien_Profile.jpg</option><option>https://imgur.com/upload?beta</option><option></option></datalist></td><td>imagePath</td>\n" +
        "</tr>\n" +
        "<tr><td>upload</td><td><datalist><option></option></datalist></td><td>${imagePath},${imagePath},${imagePath}</td>\n" +
        "</tr>\n" +
        "<tr><td>waitForElementPresent</td><td>css=button.Button.Button-hidden.isActive<datalist><option>css=button.Button.Button-hidden.isActive</option><option>xpath=//div[@id='root']/div/div/div/div[4]/div[2]/div/div/div[2]/button[2]</option><option>xpath=(.//!*[normalize-space(text()) and normalize-space(.)='To Community'])[1]/following::button[1]</option><option>xpath=(.//!*[normalize-space(text()) and normalize-space(.)='Post'])[1]/following::button[2]</option><option>xpath=//div[2]/button[2]</option></datalist></td><td></td>\n" +
        "</tr>\n" +
        "</tbody></table>\n" +
        "</body>\n" +
        "</html>",
},
{
    testSuiteName: "Extract and write data to a CSV file",
    projectName: "Extract and write data to a CSV file",
    description: "Iteratively extract and write data to a CSV file",
    testSuite: `<?xml version="1.0" encoding="UTF-8"?>"
    <!DOCTYPE html PUBLIC "-//W3C//DTD XHTML 1.0 Strict//EN" "http://www.w3.org/TR/xhtml1/DTD/xhtml1-strict.dtd">
    <html xmlns="http://www.w3.org/1999/xhtml" xml:lang="en" lang="en">
    <head>
    <meta content="text/html; charset=UTF-8" http-equiv="content-type" />
    <title>Extract and write data to a CSV file</title>
    </head>
    <body>
    <table cellpadding="1" cellspacing="1" border="1">
    <thead>
    <tr><td rowspan="1" colspan="3" data-tags="">Extract items and write to CSV</td></tr>
    </thead>
    <tbody>
    <tr><td>open</td><td>https://cms.demo.katalon.com/<datalist><option>https://cms.demo.katalon.com/</option></datalist></td><td></td></tr>
    <tr><td>click</td><td>xpath=//main[@id='main']/div[2]/ul/li[1]/div/a[2]<datalist><option>link=Add to cart</option><option>xpath=//a[contains(text(),'Add to cart')]</option><option>xpath=//main[@id='main']/div[2]/ul/li/div/a[2]</option><option>xpath=(.//*[normalize-space(text()) and normalize-space(.)='Sale!'])[1]/following::a[1]</option><option>xpath=(.//*[normalize-space(text()) and normalize-space(.)='Default sorting'])[2]/following::a[2]</option><option>xpath=(.//*[normalize-space(text()) and normalize-space(.)='Flying Ninja'])[1]/preceding::a[1]</option><option>xpath=(.//*[normalize-space(text()) and normalize-space(.)='$'])[1]/preceding::a[1]</option><option>xpath=//*/text()[normalize-space(.)='Add to cart']/parent::*</option><option>xpath=//a[contains(@href, '?add-to-cart=54')]</option><option>xpath=//a[2]</option><option>css=a.button.product_type_simple.add_to_cart_button.ajax_add_to_cart</option><option>xpath=//main[@id='main']/div[2]/ul/li[1]/div/a[2]</option></datalist></td><td></td></tr>
    <tr><td>click</td><td>xpath=//main[@id='main']/div[2]/ul/li[2]/div/a[2]<datalist><option>xpath=//main[@id='main']/div[2]/ul/li[2]/div/a[2]</option><option>xpath=(.//*[normalize-space(text()) and normalize-space(.)='$'])[2]/following::a[2]</option><option>xpath=(.//*[normalize-space(text()) and normalize-space(.)='$'])[1]/following::a[2]</option><option>xpath=(.//*[normalize-space(text()) and normalize-space(.)='Happy Ninja'])[1]/preceding::a[1]</option><option>xpath=(.//*[normalize-space(text()) and normalize-space(.)='$'])[3]/preceding::a[1]</option><option>xpath=//a[contains(@href, '?add-to-cart=26')]</option><option>xpath=//li[2]/div/a[2]</option><option>css=li.product.type-product.post-26.status-publish.instock.product_cat-clothing.product_cat-t-shirts.has-post-thumbnail.taxable.shipping-taxable.purchasable.product-type-simple > div.ellie-thumb-wrapper > a.button.product_type_simple.add_to_cart_button.ajax_add_to_cart</option></datalist></td><td></td></tr>
    <tr><td>click</td><td>xpath=//main[@id='main']/div[2]/ul/li[3]/div/a[2]<datalist><option>xpath=//main[@id='main']/div[2]/ul/li[3]/div/a[2]</option><option>xpath=(.//*[normalize-space(text()) and normalize-space(.)='$'])[3]/following::a[2]</option><option>xpath=(.//*[normalize-space(text()) and normalize-space(.)='Happy Ninja'])[1]/following::a[2]</option><option>xpath=(.//*[normalize-space(text()) and normalize-space(.)='Happy Ninja'])[2]/preceding::a[1]</option><option>xpath=(.//*[normalize-space(text()) and normalize-space(.)='$'])[4]/preceding::a[1]</option><option>xpath=//a[contains(@href, '?add-to-cart=27')]</option><option>xpath=//li[3]/div/a[2]</option><option>css=li.product.type-product.post-27.status-publish.last.instock.product_cat-clothing.product_cat-hoodies.has-post-thumbnail.taxable.shipping-taxable.purchasable.product-type-simple > div.ellie-thumb-wrapper > a.button.product_type_simple.add_to_cart_button.ajax_add_to_cart</option></datalist></td><td></td></tr>
    <tr><td>click</td><td>xpath=//main[@id='main']/div[2]/ul/li[4]/div/a[2]<datalist><option>xpath=//main[@id='main']/div[2]/ul/li[4]/div/a[2]</option><option>xpath=(.//*[normalize-space(text()) and normalize-space(.)='$'])[4]/following::a[2]</option><option>xpath=(.//*[normalize-space(text()) and normalize-space(.)='Happy Ninja'])[2]/following::a[2]</option><option>xpath=(.//*[normalize-space(text()) and normalize-space(.)='Ninja Silhouette'])[1]/preceding::a[1]</option><option>xpath=(.//*[normalize-space(text()) and normalize-space(.)='$'])[5]/preceding::a[1]</option><option>xpath=//a[contains(@href, '?add-to-cart=25')]</option><option>xpath=//li[4]/div/a[2]</option><option>css=li.product.type-product.post-25.status-publish.first.instock.product_cat-clothing.product_cat-t-shirts.has-post-thumbnail.taxable.shipping-taxable.purchasable.product-type-simple > div.ellie-thumb-wrapper > a.button.product_type_simple.add_to_cart_button.ajax_add_to_cart</option></datalist></td><td></td></tr>
    <tr><td>open</td><td>https://cms.demo.katalon.com/checkout<datalist><option>link=Checkout</option><option>xpath=//a[contains(text(),'Checkout')]</option><option>xpath=//div[@id='primary-menu']/ul/li[2]/a</option><option>xpath=(.//*[normalize-space(text()) and normalize-space(.)='Cart'])[1]/following::a[1]</option><option>xpath=(.//*[normalize-space(text()) and normalize-space(.)='Menu'])[1]/following::a[2]</option><option>xpath=(.//*[normalize-space(text()) and normalize-space(.)='My account'])[1]/preceding::a[1]</option><option>xpath=(.//*[normalize-space(text()) and normalize-space(.)='Sample Page'])[1]/preceding::a[2]</option><option>xpath=//*/text()[normalize-space(.)='Checkout']/parent::*</option><option>xpath=//a[contains(@href, 'https://cms.demo.katalon.com/checkout/')]</option><option>xpath=//li[2]/a</option><option>css=li.page_item.page-item-9.focus > a</option><option>https://cms.demo.katalon.com/checkout</option></datalist></td><td></td></tr>
    <tr><td>storeXpathCount</td><td>//*[@id="order_review"]/table/tbody/tr<datalist><option>//*[@id="order_review"]/table/tbody/tr</option></datalist></td><td>rowNum</td></tr>
    <tr><td>store</td><td>1<datalist><option>1</option></datalist></td><td>index</td></tr>`+
        "<tr><td>while</td><td>${index} <= ${rowNum}<datalist><option>${index} < ${rowNum}</option><option>${index} <= ${rowNum}</option></datalist></td><td></td></tr>" +
        '<tr><td>storeText</td><td>//*[@id="order_review"]/table/tbody/tr[${index}]/td[1]<datalist><option>//*[@id="order_review"]/table/tbody/tr[${ID}]/td[1]</option><option>//*[@id="order_review"]/table/tbody/tr[${index}]/td[1]</option></datalist></td><td>itemName</td></tr>' +
        '<tr><td>storeText</td><td>//*[@id="order_review"]/table/tbody/tr[${index}]/td[2]<datalist><option>//*[@id="order_review"]/table/tbody/tr[${ID}]/td[2]</option><option>//*[@id="order_review"]/table/tbody/tr[${index}]/td[2]</option></datalist></td><td>itemPrice</td></tr>' +
        '<tr><td>appendToCSV</td><td>name-price.csv<datalist><option>name-price.csv</option><option>name-prices.csv</option></datalist></td><td>${itemName}, ${itemPrice}</td></tr>' +
        '<tr><td>storeEval</td><td>${index} + 1<datalist><option>${index} + 1</option></datalist></td><td>index</td></tr>' +
        `<tr><td>endWhile</td><td><datalist></datalist></td><td></td></tr>
    </tbody></table>
    </body>
    </html>`,
    data: {
        "name-price.csv": {
            "content": "name,price",
            "type": "csv"
        }
    }
},
{
    testSuiteName: "Extract data and verify textual patterns.",
    projectName: "Extract data and verify textual patterns.",
    description: "Extract data from a website and verify it with a regular expression.",
    testSuite: `<?xml version="1.0" encoding="UTF-8"?>
    <!DOCTYPE html PUBLIC "-//W3C//DTD XHTML 1.0 Strict//EN" "http://www.w3.org/TR/xhtml1/DTD/xhtml1-strict.dtd">
    <html xmlns="http://www.w3.org/1999/xhtml" xml:lang="en" lang="en">
    <head>
    <meta content="text/html; charset=UTF-8" http-equiv="content-type" />
    <title>Extract and verify</title>
    </head>
    <body>
    <table cellpadding="1" cellspacing="1" border="1">
    <thead>
    <tr><td rowspan="1" colspan="3" data-tags="">Extract data and verify item price</td></tr>
    </thead>
    <tbody>
    <tr><td>open</td><td>https://demo-store.katalon.com/<datalist><option>https://demo-store.katalon.com/</option></datalist></td><td></td></tr>
    <tr><td>click</td><td>xpath=//img[contains(@src,'https://static.zara.net/photos///2018/I/0/1/p/7568/469/251/2/w/1920/7568469251_2_1_1.jpg?ts=1540393989160')]<datalist><option>xpath=//img[contains(@src,'https://static.zara.net/photos///2018/I/0/1/p/7568/469/251/2/w/1920/7568469251_2_1_1.jpg?ts=1540393989160')]</option><option>xpath=//div[@id='root']/div/div/div[2]/div[2]/div/div/img</option><option>xpath=(.//*[normalize-space(text()) and normalize-space(.)='Clear All'])[1]/following::img[1]</option><option>xpath=(.//*[normalize-space(text()) and normalize-space(.)='Greater Than $89'])[1]/following::img[1]</option><option>xpath=(.//*[normalize-space(text()) and normalize-space(.)='Basic Top'])[1]/preceding::img[1]</option><option>xpath=(.//*[normalize-space(text()) and normalize-space(.)='$25.99 CAD'])[1]/preceding::img[1]</option><option>xpath=//img</option><option>css=img.card-img-top</option></datalist></td><td></td></tr>
    <tr><td>storeText</td><td>xpath=//div[@id='root']/div/div/div/div[2]/div/div[2]/div/div[3]<datalist><option>xpath=//div[@id='root']/div/div/div/div[2]/div/div[2]/div/d</option><option>xpath=//div[@id='root']/div/div/div/div[2]/div/div[2]/div/div[3]</option></datalist></td><td>displayedPrice</td></tr>
    <tr><td>storeEval</td><td>`+ '"${displayedPrice}"' + `.substring(0, 6)<datalist><option>` + "${displayedPrice}" + `.substring(0, 6)</option></datalist></td><td>itemPrice</td></tr>
    <tr><td>verifyEval</td><td>`+ '"${itemPrice}"' + `<datalist><option>` + "${itemPrice}" + `</option></datalist></td><td>regexp:^[$](\\d+\\.\\d+)</td></tr>
    </tbody></table>
    </body>
    </html>`
},
{
    testSuiteName: "Implement data-driven testing",
    projectName: "Implement data-driven testing",
    description: "Collect data from a CSV file to fill in multiple forms.",
    testSuite: `<?xml version="1.0" encoding="UTF-8"?>
    <!DOCTYPE html PUBLIC "-//W3C//DTD XHTML 1.0 Strict//EN" "http://www.w3.org/TR/xhtml1/DTD/xhtml1-strict.dtd">
    <html xmlns="http://www.w3.org/1999/xhtml" xml:lang="en" lang="en">
    <head>
    <meta content="text/html; charset=UTF-8" http-equiv="content-type" />
    <title>Implement data-driven testing</title>
    </head>
    <body>
    <table cellpadding="1" cellspacing="1" border="1">
    <thead>
    <tr><td rowspan="1" colspan="3" data-tags="">Book appointments</td></tr>
    </thead>
    <tbody>
    <tr><td>loadVars</td><td>appointments.csv<datalist><option>appointments.csv</option></datalist></td><td></td></tr>
    <tr><td>open</td><td>https://katalon-demo-cura.herokuapp.com/<datalist><option>https://katalon-demo-cura.herokuapp.com/</option></datalist></td><td></td></tr>
    <tr><td>click</td><td>xpath=//a[@id='menu-toggle']/i<datalist><option>xpath=//a[@id='menu-toggle']/i</option><option>xpath=//i</option><option>css=i.fa.fa-bars</option></datalist></td><td></td></tr>
    <tr><td>click</td><td>link=Login<datalist><option>link=Login</option><option>xpath=//a[contains(text(),'Login')]</option><option>xpath=//nav[@id='sidebar-wrapper']/ul/li[3]/a</option><option>xpath=(.//*[normalize-space(text()) and normalize-space(.)='Home'])[1]/following::a[1]</option><option>xpath=(.//*[normalize-space(text()) and normalize-space(.)='CURA Healthcare'])[1]/following::a[2]</option><option>xpath=(.//*[normalize-space(text()) and normalize-space(.)='CURA Healthcare Service'])[2]/preceding::a[1]</option><option>xpath=(.//*[normalize-space(text()) and normalize-space(.)='We Care About Your Health'])[1]/preceding::a[1]</option><option>xpath=//*/text()[normalize-space(.)='Login']/parent::*</option><option>xpath=//a[contains(@href, 'profile.php#login')]</option><option>xpath=//li[3]/a</option></datalist></td><td></td></tr>
    <tr><td>click</td><td>id=txt-username<datalist><option>id=txt-username</option><option>name=username</option><option>xpath=//input[@id='txt-username']</option><option>xpath=//section[@id='login']/div/div/div[2]/form/div[2]/div/input</option><option>xpath=//div[2]/div/input</option><option>css=#txt-username</option></datalist></td><td></td></tr>
    <tr><td>type</td><td>id=txt-username<datalist><option>id=txt-username</option><option>name=username</option><option>xpath=//input[@id='txt-username']</option><option>xpath=//section[@id='login']/div/div/div[2]/form/div[2]/div/input</option><option>xpath=//div[2]/div/input</option><option>css=#txt-username</option></datalist></td><td>John Doe</td></tr>
    <tr><td>click</td><td>id=txt-password<datalist><option>id=txt-password</option><option>name=password</option><option>xpath=//input[@id='txt-password']</option><option>xpath=//section[@id='login']/div/div/div[2]/form/div[3]/div/input</option><option>xpath=//div[3]/div/input</option><option>css=#txt-password</option></datalist></td><td></td></tr>
    <tr><td>type</td><td>id=txt-password<datalist><option>id=txt-password</option><option>name=password</option><option>xpath=//input[@id='txt-password']</option><option>xpath=//section[@id='login']/div/div/div[2]/form/div[3]/div/input</option><option>xpath=//div[3]/div/input</option><option>css=#txt-password</option></datalist></td><td>ThisIsNotAPassword</td></tr>
    <tr><td>click</td><td>id=btn-login<datalist><option>id=btn-login</option><option>xpath=//button[@id='btn-login']</option><option>xpath=//section[@id='login']/div/div/div[2]/form/div[4]/div/button</option><option>xpath=(.//*[normalize-space(text()) and normalize-space(.)='Password'])[1]/following::button[1]</option><option>xpath=(.//*[normalize-space(text()) and normalize-space(.)='Username'])[1]/following::button[1]</option><option>xpath=(.//*[normalize-space(text()) and normalize-space(.)='CURA Healthcare Service'])[3]/preceding::button[1]</option><option>xpath=(.//*[normalize-space(text()) and normalize-space(.)='(678) 813-1KMS'])[1]/preceding::button[1]</option><option>xpath=//button</option><option>css=#btn-login</option></datalist></td><td></td></tr>
    <tr><td>click</td><td>id=txt_visit_date<datalist><option>id=txt_visit_date</option><option>name=visit_date</option><option>xpath=//input[@id='txt_visit_date']</option><option>xpath=//section[@id='appointment']/div/div/form/div[4]/div/div/input</option><option>xpath=//div/input</option><option>css=#txt_visit_date</option></datalist></td><td></td></tr>
    <tr><td>type</td><td>id=txt_visit_date<datalist><option>id=txt_visit_date</option><option>name=visit_date</option><option>xpath=//input[@id='txt_visit_date']</option><option>xpath=//section[@id='appointment']/div/div/form/div[4]/div/div/input</option><option>xpath=//div/input</option><option>css=#txt_visit_date</option></datalist></td><td>`+ "${Date}" + `</td></tr>
    <tr><td>click</td><td>id=txt_comment<datalist><option>id=txt_comment</option><option>name=comment</option><option>xpath=//textarea[@id='txt_comment']</option><option>xpath=//section[@id='appointment']/div/div/form/div[5]/div/textarea</option><option>xpath=//textarea</option><option>css=#txt_comment</option></datalist></td><td></td></tr>
    <tr><td>type</td><td>id=txt_comment<datalist><option>id=txt_comment</option><option>name=comment</option><option>xpath=//textarea[@id='txt_comment']</option><option>xpath=//section[@id='appointment']/div/div/form/div[5]/div/textarea</option><option>xpath=//textarea</option><option>css=#txt_comment</option></datalist></td><td>`+ "${Comment}" + `</td></tr>
    <tr><td>click</td><td>id=btn-book-appointment<datalist><option>id=btn-book-appointment</option><option>xpath=//button[@id='btn-book-appointment']</option><option>xpath=//section[@id='appointment']/div/div/form/div[6]/div/button</option><option>xpath=(.//*[normalize-space(text()) and normalize-space(.)='Comment'])[1]/following::button[1]</option><option>xpath=(.//*[normalize-space(text()) and normalize-space(.)='Visit Date (Required)'])[1]/following::button[1]</option><option>xpath=(.//*[normalize-space(text()) and normalize-space(.)='CURA Healthcare Service'])[3]/preceding::button[1]</option><option>xpath=(.//*[normalize-space(text()) and normalize-space(.)='(678) 813-1KMS'])[1]/preceding::button[1]</option><option>xpath=//*/text()[normalize-space(.)='Book Appointment']/parent::*</option><option>xpath=//button</option><option>css=#btn-book-appointment</option></datalist></td><td></td></tr>
    <tr><td>verifyText</td><td>xpath=//section[@id='summary']/div/div/div/h2<datalist><option>xpath=//section[@id='summary']/div/div/div/h2</option><option>xpath=(.//*[normalize-space(text()) and normalize-space(.)='Make Appointment'])[1]/following::h2[1]</option><option>xpath=(.//*[normalize-space(text()) and normalize-space(.)='We Care About Your Health'])[1]/following::h2[1]</option><option>xpath=(.//*[normalize-space(text()) and normalize-space(.)='Facility'])[1]/preceding::h2[1]</option><option>xpath=(.//*[normalize-space(text()) and normalize-space(.)='Apply for hospital readmission'])[1]/preceding::h2[1]</option><option>xpath=//*/text()[normalize-space(.)='Appointment Confirmation']/parent::*</option><option>xpath=//h2</option><option>css=h2</option></datalist></td><td>Appointment Confirmation</td></tr>
    <tr><td>click</td><td>xpath=//a[@id='menu-toggle']/i<datalist><option>xpath=//a[@id='menu-toggle']/i</option><option>xpath=//i</option><option>css=i.fa.fa-bars</option></datalist></td><td></td></tr>
    <tr><td>click</td><td>link=Logout<datalist><option>link=Logout</option><option>xpath=//a[contains(text(),'Logout')]</option><option>xpath=//nav[@id='sidebar-wrapper']/ul/li[5]/a</option><option>xpath=(.//*[normalize-space(text()) and normalize-space(.)='Profile'])[1]/following::a[1]</option><option>xpath=(.//*[normalize-space(text()) and normalize-space(.)='History'])[1]/following::a[2]</option><option>xpath=(.//*[normalize-space(text()) and normalize-space(.)='CURA Healthcare Service'])[2]/preceding::a[1]</option><option>xpath=(.//*[normalize-space(text()) and normalize-space(.)='We Care About Your Health'])[1]/preceding::a[1]</option><option>xpath=//*/text()[normalize-space(.)='Logout']/parent::*</option><option>xpath=//a[contains(@href, 'authenticate.php?logout')]</option><option>xpath=//li[5]/a</option></datalist></td><td></td></tr>
    <tr><td>endLoadVars</td><td><datalist></datalist></td><td></td></tr>
    </tbody></table>
    </body>
    </html>`,
    data: {
        "appointments.csv": {
            "content": "Date,Comment,\n28/03/2022,#1-Schedule an appointment,\n29/03/2022,#2-Schedule an appointment,\n30/03/2022,#3-Schedule an appointment",
            "type": "csv"
        }
    }
},
{
    testSuiteName: "Implement control flow in a test case",
    projectName: "Implement control flow in a test case",
    description: "Use control flow commands to iteratively select and verify elements on a website.",
    testSuite: `<?xml version="1.0" encoding="UTF-8"?>
    <!DOCTYPE html PUBLIC "-//W3C//DTD XHTML 1.0 Strict//EN" "http://www.w3.org/TR/xhtml1/DTD/xhtml1-strict.dtd">
    <html xmlns="http://www.w3.org/1999/xhtml" xml:lang="en" lang="en">
    <head>
    <meta content="text/html; charset=UTF-8" http-equiv="content-type" />
    <title>Implement control flow in a test case</title>
    </head>
    <body>
    <table cellpadding="1" cellspacing="1" border="1">
    <thead>
    <tr><td rowspan="1" colspan="3" data-tags="">Add items to cart and confirm (manually)</td></tr>
    </thead>
    <tbody>
    <tr><td>open</td><td>https://cms.demo.katalon.com/<datalist><option>https://cms.demo.katalon.com/</option></datalist></td><td></td></tr>
    <tr><td>click</td><td>xpath=//main[@id='main']/div[2]/ul/li[1]/div/a[2]<datalist><option>link=Add to cart</option><option>xpath=//a[contains(text(),'Add to cart')]</option><option>xpath=//main[@id='main']/div[2]/ul/li/div/a[2]</option><option>xpath=(.//*[normalize-space(text()) and normalize-space(.)='Sale!'])[1]/following::a[1]</option><option>xpath=(.//*[normalize-space(text()) and normalize-space(.)='Default sorting'])[2]/following::a[2]</option><option>xpath=(.//*[normalize-space(text()) and normalize-space(.)='Flying Ninja'])[1]/preceding::a[1]</option><option>xpath=(.//*[normalize-space(text()) and normalize-space(.)='$'])[1]/preceding::a[1]</option><option>xpath=//*/text()[normalize-space(.)='Add to cart']/parent::*</option><option>xpath=//a[contains(@href, '?add-to-cart=54')]</option><option>xpath=//a[2]</option><option>css=a.button.product_type_simple.add_to_cart_button.ajax_add_to_cart</option><option>xpath=//main[@id='main']/div[2]/ul/li[2]/div/a[1]</option><option>xpath=//main[@id='main']/div[2]/ul/li[2]/div/a[2]</option><option>xpath=//main[@id='main']/div[2]/ul/li[1]/div/a[2]</option></datalist></td><td></td></tr>
    <tr><td>verifyText</td><td>xpath=//main[@id='main']/div[2]/ul/li[1]/div/a[3]<datalist><option>link=View cart</option><option>xpath=//a[contains(text(),'View cart')]</option><option>xpath=//main[@id='main']/div[2]/ul/li/div/a[3]</option><option>xpath=(.//*[normalize-space(text()) and normalize-space(.)='Add to cart'])[1]/following::a[1]</option><option>xpath=(.//*[normalize-space(text()) and normalize-space(.)='Sale!'])[1]/following::a[2]</option><option>xpath=(.//*[normalize-space(text()) and normalize-space(.)='Flying Ninja'])[1]/preceding::a[1]</option><option>xpath=(.//*[normalize-space(text()) and normalize-space(.)='$'])[1]/preceding::a[1]</option><option>xpath=//*/text()[normalize-space(.)='View cart']/parent::*</option><option>xpath=//a[3]</option><option>css=a.added_to_cart.wc-forward</option><option>xpath=//main[@id='main']/div[2]/ul/li[2]/div/a[3]</option><option>xpath=//main[@id='main']/div[2]/ul/li[1]/div/a[3]</option></datalist></td><td>View cart</td></tr>
    <tr><td>click</td><td>xpath=//main[@id='main']/div[2]/ul/li[2]/div/a[2]<datalist><option>xpath=//main[@id='main']/div[2]/ul/li[2]/div/a[2]</option><option>xpath=(.//*[normalize-space(text()) and normalize-space(.)='$'])[2]/following::a[2]</option><option>xpath=(.//*[normalize-space(text()) and normalize-space(.)='$'])[1]/following::a[2]</option><option>xpath=(.//*[normalize-space(text()) and normalize-space(.)='Happy Ninja'])[1]/preceding::a[1]</option><option>xpath=(.//*[normalize-space(text()) and normalize-space(.)='$'])[3]/preceding::a[1]</option><option>xpath=//a[contains(@href, '?add-to-cart=26')]</option><option>xpath=//li[2]/div/a[2]</option><option>css=li.product.type-product.post-26.status-publish.instock.product_cat-clothing.product_cat-t-shirts.has-post-thumbnail.taxable.shipping-taxable.purchasable.product-type-simple > div.ellie-thumb-wrapper > a.button.product_type_simple.add_to_cart_button.ajax_add_to_cart</option></datalist></td><td></td></tr>
    <tr><td>verifyText</td><td>xpath=//main[@id='main']/div[2]/ul/li[2]/div/a[3]<datalist><option>xpath=//main[@id='main']/div[2]/ul/li[2]/div/a[3]</option><option>xpath=(.//*[normalize-space(text()) and normalize-space(.)='Add to cart'])[2]/following::a[1]</option><option>xpath=(.//*[normalize-space(text()) and normalize-space(.)='$'])[2]/following::a[3]</option><option>xpath=(.//*[normalize-space(text()) and normalize-space(.)='Happy Ninja'])[1]/preceding::a[1]</option><option>xpath=(.//*[normalize-space(text()) and normalize-space(.)='$'])[3]/preceding::a[1]</option><option>xpath=//li[2]/div/a[3]</option><option>css=li.product.type-product.post-26.status-publish.instock.product_cat-clothing.product_cat-t-shirts.has-post-thumbnail.taxable.shipping-taxable.purchasable.product-type-simple > div.ellie-thumb-wrapper > a.added_to_cart.wc-forward</option></datalist></td><td>View cart</td></tr>
    <tr><td>click</td><td>xpath=//main[@id='main']/div[2]/ul/li[3]/div/a[2]<datalist><option>xpath=//main[@id='main']/div[2]/ul/li[3]/div/a[2]</option><option>xpath=(.//*[normalize-space(text()) and normalize-space(.)='$'])[3]/following::a[2]</option><option>xpath=(.//*[normalize-space(text()) and normalize-space(.)='Happy Ninja'])[1]/following::a[2]</option><option>xpath=(.//*[normalize-space(text()) and normalize-space(.)='Happy Ninja'])[2]/preceding::a[1]</option><option>xpath=(.//*[normalize-space(text()) and normalize-space(.)='$'])[4]/preceding::a[1]</option><option>xpath=//a[contains(@href, '?add-to-cart=27')]</option><option>xpath=//li[3]/div/a[2]</option><option>css=li.product.type-product.post-27.status-publish.last.instock.product_cat-clothing.product_cat-hoodies.has-post-thumbnail.taxable.shipping-taxable.purchasable.product-type-simple > div.ellie-thumb-wrapper > a.button.product_type_simple.add_to_cart_button.ajax_add_to_cart</option></datalist></td><td></td></tr>
    <tr><td>verifyText</td><td>xpath=//main[@id='main']/div[2]/ul/li[3]/div/a[3]<datalist><option>xpath=//main[@id='main']/div[2]/ul/li[3]/div/a[3]</option><option>xpath=(.//*[normalize-space(text()) and normalize-space(.)='Add to cart'])[3]/following::a[1]</option><option>xpath=(.//*[normalize-space(text()) and normalize-space(.)='$'])[3]/following::a[3]</option><option>xpath=(.//*[normalize-space(text()) and normalize-space(.)='Happy Ninja'])[2]/preceding::a[1]</option><option>xpath=(.//*[normalize-space(text()) and normalize-space(.)='$'])[4]/preceding::a[1]</option><option>xpath=//li[3]/div/a[3]</option><option>css=li.product.type-product.post-27.status-publish.last.instock.product_cat-clothing.product_cat-hoodies.has-post-thumbnail.taxable.shipping-taxable.purchasable.product-type-simple > div.ellie-thumb-wrapper > a.added_to_cart.wc-forward</option></datalist></td><td>View cart</td></tr>
    <tr><td>click</td><td>xpath=//main[@id='main']/div[2]/ul/li[4]/div/a[2]<datalist><option>xpath=//main[@id='main']/div[2]/ul/li[4]/div/a[2]</option><option>xpath=(.//*[normalize-space(text()) and normalize-space(.)='$'])[4]/following::a[2]</option><option>xpath=(.//*[normalize-space(text()) and normalize-space(.)='Happy Ninja'])[2]/following::a[2]</option><option>xpath=(.//*[normalize-space(text()) and normalize-space(.)='Ninja Silhouette'])[1]/preceding::a[1]</option><option>xpath=(.//*[normalize-space(text()) and normalize-space(.)='$'])[5]/preceding::a[1]</option><option>xpath=//a[contains(@href, '?add-to-cart=25')]</option><option>xpath=//li[4]/div/a[2]</option><option>css=li.product.type-product.post-25.status-publish.first.instock.product_cat-clothing.product_cat-t-shirts.has-post-thumbnail.taxable.shipping-taxable.purchasable.product-type-simple > div.ellie-thumb-wrapper > a.button.product_type_simple.add_to_cart_button.ajax_add_to_cart</option></datalist></td><td></td></tr>
    <tr><td>verifyText</td><td>xpath=//main[@id='main']/div[2]/ul/li[4]/div/a[3]<datalist><option>xpath=//main[@id='main']/div[2]/ul/li[4]/div/a[3]</option><option>xpath=(.//*[normalize-space(text()) and normalize-space(.)='Add to cart'])[4]/following::a[1]</option><option>xpath=(.//*[normalize-space(text()) and normalize-space(.)='$'])[4]/following::a[3]</option><option>xpath=(.//*[normalize-space(text()) and normalize-space(.)='Ninja Silhouette'])[1]/preceding::a[1]</option><option>xpath=(.//*[normalize-space(text()) and normalize-space(.)='$'])[5]/preceding::a[1]</option><option>xpath=//li[4]/div/a[3]</option><option>css=li.product.type-product.post-25.status-publish.first.instock.product_cat-clothing.product_cat-t-shirts.has-post-thumbnail.taxable.shipping-taxable.purchasable.product-type-simple > div.ellie-thumb-wrapper > a.added_to_cart.wc-forward</option></datalist></td><td>View cart</td></tr>
    <tr><td>click</td><td>xpath=//main[@id='main']/div[2]/ul/li[6]/div/a[2]<datalist><option>xpath=//main[@id='main']/div[2]/ul/li[6]/div/a[2]</option><option>xpath=(.//*[normalize-space(text()) and normalize-space(.)='$'])[6]/following::a[2]</option><option>xpath=(.//*[normalize-space(text()) and normalize-space(.)='Ninja Silhouette'])[2]/following::a[2]</option><option>xpath=(.//*[normalize-space(text()) and normalize-space(.)='Patient Ninja'])[1]/preceding::a[1]</option><option>xpath=(.//*[normalize-space(text()) and normalize-space(.)='$'])[7]/preceding::a[1]</option><option>xpath=//a[contains(@href, '?add-to-cart=66')]</option><option>xpath=//li[6]/div/a[2]</option><option>css=li.product.type-product.post-66.status-publish.last.instock.product_cat-clothing.product_cat-hoodies.has-post-thumbnail.taxable.shipping-taxable.purchasable.product-type-simple > div.ellie-thumb-wrapper > a.button.product_type_simple.add_to_cart_button.ajax_add_to_cart</option></datalist></td><td></td></tr>
    <tr><td>verifyText</td><td>xpath=//main[@id='main']/div[2]/ul/li[6]/div/a[3]<datalist><option>xpath=//main[@id='main']/div[2]/ul/li[6]/div/a[3]</option><option>xpath=(.//*[normalize-space(text()) and normalize-space(.)='Add to cart'])[5]/following::a[1]</option><option>xpath=(.//*[normalize-space(text()) and normalize-space(.)='$'])[6]/following::a[3]</option><option>xpath=(.//*[normalize-space(text()) and normalize-space(.)='Patient Ninja'])[1]/preceding::a[1]</option><option>xpath=(.//*[normalize-space(text()) and normalize-space(.)='$'])[7]/preceding::a[1]</option><option>xpath=//li[6]/div/a[3]</option><option>css=li.product.type-product.post-66.status-publish.last.instock.product_cat-clothing.product_cat-hoodies.has-post-thumbnail.taxable.shipping-taxable.purchasable.product-type-simple > div.ellie-thumb-wrapper > a.added_to_cart.wc-forward</option></datalist></td><td>View cart</td></tr>
    <tr><td>click</td><td>xpath=//main[@id='main']/div[2]/ul/li[7]/div/a[2]<datalist><option>xpath=//main[@id='main']/div[2]/ul/li[7]/div/a[2]</option><option>xpath=(.//*[normalize-space(text()) and normalize-space(.)='$'])[7]/following::a[2]</option><option>xpath=(.//*[normalize-space(text()) and normalize-space(.)='Patient Ninja'])[1]/following::a[2]</option><option>xpath=(.//*[normalize-space(text()) and normalize-space(.)='Premium Quality'])[1]/preceding::a[1]</option><option>xpath=(.//*[normalize-space(text()) and normalize-space(.)='$'])[8]/preceding::a[1]</option><option>xpath=//a[contains(@href, '?add-to-cart=22')]</option><option>xpath=//li[7]/div/a[2]</option><option>css=li.product.type-product.post-22.status-publish.first.instock.product_cat-clothing.product_cat-t-shirts.has-post-thumbnail.taxable.shipping-taxable.purchasable.product-type-simple > div.ellie-thumb-wrapper > a.button.product_type_simple.add_to_cart_button.ajax_add_to_cart</option></datalist></td><td></td></tr>
    <tr><td>verifyText</td><td>xpath=//main[@id='main']/div[2]/ul/li[7]/div/a[3]<datalist><option>xpath=//main[@id='main']/div[2]/ul/li[7]/div/a[3]</option><option>xpath=(.//*[normalize-space(text()) and normalize-space(.)='Add to cart'])[6]/following::a[1]</option><option>xpath=(.//*[normalize-space(text()) and normalize-space(.)='$'])[7]/following::a[3]</option><option>xpath=(.//*[normalize-space(text()) and normalize-space(.)='Premium Quality'])[1]/preceding::a[1]</option><option>xpath=(.//*[normalize-space(text()) and normalize-space(.)='$'])[8]/preceding::a[1]</option><option>xpath=//li[7]/div/a[3]</option><option>css=li.product.type-product.post-22.status-publish.first.instock.product_cat-clothing.product_cat-t-shirts.has-post-thumbnail.taxable.shipping-taxable.purchasable.product-type-simple > div.ellie-thumb-wrapper > a.added_to_cart.wc-forward</option></datalist></td><td>View cart</td></tr>
    <tr><td>click</td><td>xpath=//main[@id='main']/div[2]/ul/li[8]/div/a[2]<datalist><option>xpath=//main[@id='main']/div[2]/ul/li[8]/div/a[2]</option><option>xpath=(.//*[normalize-space(text()) and normalize-space(.)='Sale!'])[2]/following::a[1]</option><option>xpath=(.//*[normalize-space(text()) and normalize-space(.)='$'])[8]/following::a[2]</option><option>xpath=(.//*[normalize-space(text()) and normalize-space(.)='Premium Quality'])[2]/preceding::a[1]</option><option>xpath=(.//*[normalize-space(text()) and normalize-space(.)='$'])[9]/preceding::a[1]</option><option>xpath=//a[contains(@href, '?add-to-cart=51')]</option><option>xpath=//li[8]/div/a[2]</option><option>css=li.product.type-product.post-51.status-publish.instock.product_cat-posters.has-post-thumbnail.sale.taxable.shipping-taxable.purchasable.product-type-simple > div.ellie-thumb-wrapper > a.button.product_type_simple.add_to_cart_button.ajax_add_to_cart</option></datalist></td><td></td></tr>
    <tr><td>verifyText</td><td>xpath=//main[@id='main']/div[2]/ul/li[8]/div/a[3]<datalist><option>xpath=//main[@id='main']/div[2]/ul/li[8]/div/a[3]</option><option>xpath=(.//*[normalize-space(text()) and normalize-space(.)='Add to cart'])[7]/following::a[1]</option><option>xpath=(.//*[normalize-space(text()) and normalize-space(.)='Sale!'])[2]/following::a[2]</option><option>xpath=(.//*[normalize-space(text()) and normalize-space(.)='Premium Quality'])[2]/preceding::a[1]</option><option>xpath=(.//*[normalize-space(text()) and normalize-space(.)='$'])[9]/preceding::a[1]</option><option>xpath=//li[8]/div/a[3]</option><option>css=li.product.type-product.post-51.status-publish.instock.product_cat-posters.has-post-thumbnail.sale.taxable.shipping-taxable.purchasable.product-type-simple > div.ellie-thumb-wrapper > a.added_to_cart.wc-forward</option></datalist></td><td>View cart</td></tr>
    <tr><td>click</td><td>xpath=//main[@id='main']/div[2]/ul/li[11]/div/a[2]<datalist><option>xpath=//main[@id='main']/div[2]/ul/li[11]/div/a[2]</option><option>xpath=(.//*[normalize-space(text()) and normalize-space(.)='$'])[13]/following::a[2]</option><option>xpath=(.//*[normalize-space(text()) and normalize-space(.)='$'])[12]/following::a[2]</option><option>xpath=(.//*[normalize-space(text()) and normalize-space(.)='Ship Your Idea'])[3]/preceding::a[1]</option><option>xpath=(.//*[normalize-space(text()) and normalize-space(.)='$'])[14]/preceding::a[1]</option><option>xpath=//a[contains(@href, '?add-to-cart=57')]</option><option>xpath=//li[11]/div/a[2]</option><option>css=li.product.type-product.post-57.status-publish.instock.product_cat-posters.has-post-thumbnail.taxable.shipping-taxable.purchasable.product-type-simple > div.ellie-thumb-wrapper > a.button.product_type_simple.add_to_cart_button.ajax_add_to_cart</option></datalist></td><td></td></tr>
    <tr><td>verifyText</td><td>xpath=//main[@id='main']/div[2]/ul/li[11]/div/a[3]<datalist><option>xpath=//main[@id='main']/div[2]/ul/li[11]/div/a[3]</option><option>xpath=(.//*[normalize-space(text()) and normalize-space(.)='Add to cart'])[8]/following::a[1]</option><option>xpath=(.//*[normalize-space(text()) and normalize-space(.)='$'])[13]/following::a[3]</option><option>xpath=(.//*[normalize-space(text()) and normalize-space(.)='Ship Your Idea'])[3]/preceding::a[1]</option><option>xpath=(.//*[normalize-space(text()) and normalize-space(.)='$'])[14]/preceding::a[1]</option><option>xpath=//li[11]/div/a[3]</option><option>css=li.product.type-product.post-57.status-publish.instock.product_cat-posters.has-post-thumbnail.taxable.shipping-taxable.purchasable.product-type-simple > div.ellie-thumb-wrapper > a.added_to_cart.wc-forward</option></datalist></td><td>View cart</td></tr>
    <tr><td>click</td><td>xpath=//main[@id='main']/div[2]/ul/li[12]/div/a[2]<datalist><option>xpath=//main[@id='main']/div[2]/ul/li[12]/div/a[2]</option><option>xpath=(.//*[normalize-space(text()) and normalize-space(.)='$'])[14]/following::a[2]</option><option>xpath=(.//*[normalize-space(text()) and normalize-space(.)='Ship Your Idea'])[3]/following::a[2]</option><option>xpath=(.//*[normalize-space(text()) and normalize-space(.)='Woo Album #1'])[1]/preceding::a[1]</option><option>xpath=(.//*[normalize-space(text()) and normalize-space(.)='$'])[15]/preceding::a[1]</option><option>xpath=//a[contains(@href, '?add-to-cart=15')]</option><option>xpath=//li[12]/div/a[2]</option><option>css=li.product.type-product.post-15.status-publish.last.instock.product_cat-albums.product_cat-music.has-post-thumbnail.virtual.taxable.purchasable.product-type-simple > div.ellie-thumb-wrapper > a.button.product_type_simple.add_to_cart_button.ajax_add_to_cart</option></datalist></td><td></td></tr>
    <tr><td>verifyText</td><td>xpath=//main[@id='main']/div[2]/ul/li[12]/div/a[3]<datalist><option>xpath=//main[@id='main']/div[2]/ul/li[12]/div/a[3]</option><option>xpath=(.//*[normalize-space(text()) and normalize-space(.)='Add to cart'])[9]/following::a[1]</option><option>xpath=(.//*[normalize-space(text()) and normalize-space(.)='$'])[14]/following::a[3]</option><option>xpath=(.//*[normalize-space(text()) and normalize-space(.)='Woo Album #1'])[1]/preceding::a[1]</option><option>xpath=(.//*[normalize-space(text()) and normalize-space(.)='$'])[15]/preceding::a[1]</option><option>xpath=//li[12]/div/a[3]</option><option>css=li.product.type-product.post-15.status-publish.last.instock.product_cat-albums.product_cat-music.has-post-thumbnail.virtual.taxable.purchasable.product-type-simple > div.ellie-thumb-wrapper > a.added_to_cart.wc-forward</option></datalist></td><td>View cart</td></tr>
    </tbody></table>
    <table cellpadding="1" cellspacing="1" border="1">
    <thead>
    <tr><td rowspan="1" colspan="3" data-tags="">Add items to cart and confirm (with control flow)</td></tr>
    </thead>
    <tbody>
    <tr><td>open</td><td>https://cms.demo.katalon.com<datalist><option>https://cms.demo.katalon.com</option></datalist></td><td></td></tr>
    <tr><td>store</td><td>1<datalist><option>1</option></datalist></td><td>index</td></tr>`+
        '<tr><td>while</td><td>${index} < 13<datalist><option>${index} < 13</option></datalist></td><td></td></tr>' +
        "<tr><td>storeText</td><td>xpath=//main[@id='main']/div[2]/ul/li[${index}]/div/a[2]<datalist><option>xpath=//main[@id='main']/div[2]/ul/li[${ID}]/div/a[2]</option><option>xpath=//main[@id='main']/div[2]/ul/li[${index}]/div/a[2]</option></datalist></td><td>itemText</td></tr>" +
        '<tr><td>if</td><td>"${itemText}" == "Add to cart"<datalist><option>"${itemText}" == "Add to cart"</option></datalist></td><td></td></tr>' +
        "<tr><td>click</td><td>xpath=//main[@id='main']/div[2]/ul/li[${index}]/div/a[2]<datalist><option>xpath=//main[@id='main']/div[2]/ul/li[${ID}]/div/a[2]</option><option>xpath=//main[@id='main']/div[2]/ul/li[${index}]/div/a[2]</option></datalist></td><td></td></tr>" +
        '<tr><td>pause</td><td><datalist></datalist></td><td>1000</td></tr>' +
        "<tr><td>verifyText</td><td>xpath=//main[@id='main']/div[2]/ul/li[${index}]/div/a[3]<datalist><option>xpath=//main[@id='main']/div[2]/ul/li[${index}]/div/a[3]</option></datalist></td><td>View cart</td></tr>" +
        '<tr><td>endIf</td><td><datalist></datalist></td><td></td></tr>' +
        '<tr><td>storeEval</td><td>${index} + 1<datalist><option>${index} + 1</option></datalist></td><td>index</td></tr>' +
        `<tr><td>endWhile</td><td><datalist></datalist></td><td></td></tr>
    </tbody></table>
    </body>
    </html>`
},
{
    testSuiteName: "Verify textual patterns",
    projectName: "Verify textual patterns",
    description: "Outlined the whole workflow with images enlarged and step commands specifically written in text.",
    testSuite: `<?xml version="1.0" encoding="UTF-8"?>
    <!DOCTYPE html PUBLIC "-//W3C//DTD XHTML 1.0 Strict//EN" "http://www.w3.org/TR/xhtml1/DTD/xhtml1-strict.dtd">
    <html xmlns="http://www.w3.org/1999/xhtml" xml:lang="en" lang="en">
    <head>
    <meta content="text/html; charset=UTF-8" http-equiv="content-type" />
    <title>Extract and verify</title>
    </head>
    <body>
    <table cellpadding="1" cellspacing="1" border="1">
    <thead>
    <tr><td rowspan="1" colspan="3" data-tags="">Extract data and verify item price</td></tr>
    </thead>
    <tbody>
    <tr><td>open</td><td>https://demo-store.katalon.com/<datalist><option>https://demo-store.katalon.com/</option></datalist></td><td></td></tr>
    <tr><td>click</td><td>xpath=//img[contains(@src,'https://static.zara.net/photos///2018/I/0/1/p/7568/469/251/2/w/1920/7568469251_2_1_1.jpg?ts=1540393989160')]<datalist><option>xpath=//img[contains(@src,'https://static.zara.net/photos///2018/I/0/1/p/7568/469/251/2/w/1920/7568469251_2_1_1.jpg?ts=1540393989160')]</option><option>xpath=//div[@id='root']/div/div/div[2]/div[2]/div/div/img</option><option>xpath=(.//*[normalize-space(text()) and normalize-space(.)='Clear All'])[1]/following::img[1]</option><option>xpath=(.//*[normalize-space(text()) and normalize-space(.)='Greater Than $89'])[1]/following::img[1]</option><option>xpath=(.//*[normalize-space(text()) and normalize-space(.)='Basic Top'])[1]/preceding::img[1]</option><option>xpath=(.//*[normalize-space(text()) and normalize-space(.)='$25.99 CAD'])[1]/preceding::img[1]</option><option>xpath=//img</option><option>css=img.card-img-top</option></datalist></td><td></td></tr>
    <tr><td>storeText</td><td>xpath=//div[@id='root']/div/div/div/div[2]/div/div[2]/div/div[3]<datalist><option>xpath=//div[@id='root']/div/div/div/div[2]/div/div[2]/div/d</option><option>xpath=//div[@id='root']/div/div/div/div[2]/div/div[2]/div/div[3]</option></datalist></td><td>displayedPrice</td></tr>
    <tr><td>storeEval</td><td>`+ '"${displayedPrice}"' + `.substring(0, 6)<datalist><option>` + "${displayedPrice}" + `.substring(0, 6)</option></datalist></td><td>itemPrice</td></tr>
    <tr><td>verifyEval</td><td>`+ '"${itemPrice}"' + `<datalist><option>` + "${itemPrice}" + `</option></datalist></td><td>regexp:^[$](\\d+\\.\\d+)</td></tr>
    </tbody></table>
    </body>`
},
{
    testSuiteName: "Extract and write data",
    projectName: "Extract and write data",
    description: "Removed the loop implementation, limited the use case to extracting just one product info.",
    testSuite: `<?xml version="1.0" encoding="UTF-8"?>
    <!DOCTYPE html PUBLIC "-//W3C//DTD XHTML 1.0 Strict//EN" "http://www.w3.org/TR/xhtml1/DTD/xhtml1-strict.dtd">
    <html xmlns="http://www.w3.org/1999/xhtml" xml:lang="en" lang="en">
    <head>
    <meta content="text/html; charset=UTF-8" http-equiv="content-type" />
    <title>Extract item information and write to CSV</title>
    </head>
    <body>
    <table cellpadding="1" cellspacing="1" border="1">
    <thead>
    <tr><td rowspan="1" colspan="3" data-tags="">Extract item information and write to CSV</td></tr>
    </thead>
    <tbody>
    <tr><td>open</td><td>https://demo-store.katalon.com/<datalist></datalist></td><td></td></tr>
    <tr><td>click</td><td>xpath=//img[contains(@src,'https://static.zara.net/photos///2018/I/0/1/p/7568/469/251/2/w/1920/7568469251_2_1_1.jpg?ts=1540393989160')]<datalist></datalist></td><td></td></tr>
    <tr><td>storeText</td><td>xpath=//div[@id='root']/div/div/div/div[2]/div/div[2]/div/div<datalist><option>xpath=//div[@id='root']/div/div/div/div[2]/div/div[2]/div/div</option><option>xpath=(.//*[normalize-space(text()) and normalize-space(.)='All Products'])[1]/following::div[12]</option><option>xpath=(.//*[normalize-space(text()) and normalize-space(.)='Zack Market'])[2]/following::div[22]</option><option>xpath=(.//*[normalize-space(text()) and normalize-space(.)='Round neck long sleeved shirt.'])[1]/preceding::div[1]</option><option>xpath=//*/text()[normalize-space(.)='Basic Top']/parent::*</option><option>xpath=//div[2]/div/div[2]/div/div</option><option>css=div.productOverview_title__2d20j</option></datalist></td><td>itemName</td></tr>
    <tr><td>storeText</td><td>xpath=//div[@id='root']/div/div/div/div[2]/div/div[2]/div/div[3]<datalist><option>xpath=//div[@id='root']/div/div/div/div[2]/div/div[2]/div/div[3]</option><option>xpath=(.//*[normalize-space(text()) and normalize-space(.)='Round neck long sleeved shirt.'])[1]/following::div[1]</option><option>xpath=(.//*[normalize-space(text()) and normalize-space(.)='Basic Top'])[1]/following::div[2]</option><option>xpath=(.//*[normalize-space(text()) and normalize-space(.)='COLOUR:'])[1]/preceding::div[2]</option><option>xpath=(.//*[normalize-space(text()) and normalize-space(.)='White'])[1]/preceding::div[3]</option><option>xpath=//*/text()[normalize-space(.)='$']/parent::*</option><option>xpath=//div[2]/div/div[3]</option><option>css=div.productOverview_price__26ak7</option></datalist></td><td>itemPrice</td></tr>
    <tr><td>appendToCSV</td><td>name-price.csv<datalist><option>name-price.csv</option></datalist></td><td>`+ "${itemName}, ${itemPrice}" + `</td></tr>
    </tbody></table>
    </body>
    </html>`,
    data: {
        "name-price.csv": {
            "content": "Name,Price",
            "type": "csv"
        }
    }
},
{
    testSuiteName: "DDT",
    projectName: "DDT",
    description: "Simplified the test case to using only one type of data (booking comment).",
    testSuite: `<?xml version="1.0" encoding="UTF-8"?>
    <!DOCTYPE html PUBLIC "-//W3C//DTD XHTML 1.0 Strict//EN" "http://www.w3.org/TR/xhtml1/DTD/xhtml1-strict.dtd">
    <html xmlns="http://www.w3.org/1999/xhtml" xml:lang="en" lang="en">
    <head>
    <meta content="text/html; charset=UTF-8" http-equiv="content-type" />
    <title>DDT</title>
    </head>
    <body>
    <table cellpadding="1" cellspacing="1" border="1">
    <thead>
    <tr><td rowspan="1" colspan="3" data-tags="">Book appointments</td></tr>
    </thead>
    <tbody>
    <tr><td>loadVars</td><td>appointments.csv<datalist><option>appointments.csv</option></datalist></td><td></td></tr>
    <tr><td>open</td><td>https://katalon-demo-cura.herokuapp.com/<datalist><option>https://katalon-demo-cura.herokuapp.com/</option></datalist></td><td></td></tr>
    <tr><td>click</td><td>id=menu-toggle<datalist><option>id=menu-toggle</option><option>xpath=//a[@id='menu-toggle']</option><option>xpath=(.//*[normalize-space(text()) and normalize-space(.)='CURA Healthcare'])[1]/preceding::a[2]</option><option>xpath=(.//*[normalize-space(text()) and normalize-space(.)='Home'])[1]/preceding::a[3]</option><option>xpath=//a[contains(@href, '#')]</option><option>xpath=//a</option><option>css=#menu-toggle</option></datalist></td><td></td></tr>
    <tr><td>click</td><td>link=Login<datalist><option>link=Login</option><option>xpath=//a[contains(text(),'Login')]</option><option>xpath=//nav[@id='sidebar-wrapper']/ul/li[3]/a</option><option>xpath=(.//*[normalize-space(text()) and normalize-space(.)='Home'])[1]/following::a[1]</option><option>xpath=(.//*[normalize-space(text()) and normalize-space(.)='CURA Healthcare'])[1]/following::a[2]</option><option>xpath=(.//*[normalize-space(text()) and normalize-space(.)='CURA Healthcare Service'])[2]/preceding::a[1]</option><option>xpath=(.//*[normalize-space(text()) and normalize-space(.)='We Care About Your Health'])[1]/preceding::a[1]</option><option>xpath=//a[contains(@href, 'profile.php#login')]</option><option>xpath=//li[3]/a</option></datalist></td><td></td></tr>
    <tr><td>click</td><td>id=txt-username<datalist><option>id=txt-username</option><option>name=username</option><option>xpath=//input[@id='txt-username']</option><option>xpath=//section[@id='login']/div/div/div[2]/form/div[2]/div/input</option><option>xpath=(.//*[normalize-space(text()) and normalize-space(.)='Username'])[1]/following::input[1]</option><option>xpath=(.//*[normalize-space(text()) and normalize-space(.)='Demo account'])[1]/following::input[3]</option><option>xpath=(.//*[normalize-space(text()) and normalize-space(.)='Password'])[1]/preceding::input[1]</option><option>xpath=(.//*[normalize-space(text()) and normalize-space(.)='Login'])[3]/preceding::input[2]</option><option>xpath=//div[2]/div/input</option><option>css=#txt-username</option></datalist></td><td></td></tr>
    <tr><td>type</td><td>id=txt-username<datalist><option>id=txt-username</option><option>name=username</option><option>xpath=//input[@id='txt-username']</option><option>xpath=//section[@id='login']/div/div/div[2]/form/div[2]/div/input</option><option>xpath=(.//*[normalize-space(text()) and normalize-space(.)='Username'])[1]/following::input[1]</option><option>xpath=(.//*[normalize-space(text()) and normalize-space(.)='Demo account'])[1]/following::input[3]</option><option>xpath=(.//*[normalize-space(text()) and normalize-space(.)='Password'])[1]/preceding::input[1]</option><option>xpath=(.//*[normalize-space(text()) and normalize-space(.)='Login'])[3]/preceding::input[2]</option><option>xpath=//div[2]/div/input</option><option>css=#txt-username</option></datalist></td><td>John Doe</td></tr>
    <tr><td>type</td><td>id=txt-password<datalist><option>id=txt-password</option><option>name=password</option><option>xpath=//input[@id='txt-password']</option><option>xpath=//section[@id='login']/div/div/div[2]/form/div[3]/div/input</option><option>xpath=(.//*[normalize-space(text()) and normalize-space(.)='Password'])[1]/following::input[1]</option><option>xpath=(.//*[normalize-space(text()) and normalize-space(.)='Username'])[1]/following::input[2]</option><option>xpath=(.//*[normalize-space(text()) and normalize-space(.)='Login'])[3]/preceding::input[1]</option><option>xpath=(.//*[normalize-space(text()) and normalize-space(.)='CURA Healthcare Service'])[3]/preceding::input[1]</option><option>xpath=//div[3]/div/input</option><option>css=#txt-password</option></datalist></td><td>ThisIsNotAPassword</td></tr>
    <tr><td>click</td><td>id=btn-login<datalist><option>id=btn-login</option><option>xpath=//button[@id='btn-login']</option><option>xpath=//section[@id='login']/div/div/div[2]/form/div[4]/div/button</option><option>xpath=(.//*[normalize-space(text()) and normalize-space(.)='Password'])[1]/following::button[1]</option><option>xpath=(.//*[normalize-space(text()) and normalize-space(.)='Username'])[1]/following::button[1]</option><option>xpath=(.//*[normalize-space(text()) and normalize-space(.)='CURA Healthcare Service'])[3]/preceding::button[1]</option><option>xpath=(.//*[normalize-space(text()) and normalize-space(.)='(678) 813-1KMS'])[1]/preceding::button[1]</option><option>xpath=//button</option><option>css=#btn-login</option></datalist></td><td></td></tr>
    <tr><td>click</td><td>id=txt_visit_date<datalist><option>id=txt_visit_date</option><option>name=visit_date</option><option>xpath=//input[@id='txt_visit_date']</option><option>xpath=//section[@id='appointment']/div/div/form/div[4]/div/div/input</option><option>xpath=(.//*[normalize-space(text()) and normalize-space(.)='Visit Date (Required)'])[1]/following::input[1]</option><option>xpath=(.//*[normalize-space(text()) and normalize-space(.)='Comment'])[1]/preceding::input[1]</option><option>xpath=(.//*[normalize-space(text()) and normalize-space(.)='Book Appointment'])[1]/preceding::input[1]</option><option>xpath=//div/input</option><option>css=#txt_visit_date</option></datalist></td><td></td></tr>
    <tr><td>click</td><td>xpath=(.//*[normalize-space(text()) and normalize-space(.)='Sa'])[1]/following::td[35]<datalist><option>xpath=(.//*[normalize-space(text()) and normalize-space(.)='Sa'])[1]/following::td[35]</option><option>xpath=(.//*[normalize-space(text()) and normalize-space(.)='Fr'])[1]/following::td[35]</option><option>xpath=(.//*[normalize-space(text()) and normalize-space(.)='Today'])[1]/preceding::td[8]</option><option>xpath=(.//*[normalize-space(text()) and normalize-space(.)='Clear'])[1]/preceding::td[8]</option><option>xpath=//tr[5]/td[7]</option></datalist></td><td></td></tr>
    <tr><td>click</td><td>id=txt_comment<datalist><option>id=txt_comment</option><option>name=comment</option><option>xpath=//textarea[@id='txt_comment']</option><option>xpath=//section[@id='appointment']/div/div/form/div[5]/div/textarea</option><option>xpath=(.//*[normalize-space(text()) and normalize-space(.)='Comment'])[1]/following::textarea[1]</option><option>xpath=(.//*[normalize-space(text()) and normalize-space(.)='Visit Date (Required)'])[1]/following::textarea[1]</option><option>xpath=(.//*[normalize-space(text()) and normalize-space(.)='Book Appointment'])[1]/preceding::textarea[1]</option><option>xpath=(.//*[normalize-space(text()) and normalize-space(.)='CURA Healthcare Service'])[3]/preceding::textarea[1]</option><option>xpath=//textarea</option><option>css=#txt_comment</option></datalist></td><td></td></tr>
    <tr><td>type</td><td>id=txt_comment<datalist><option>id=txt_comment</option><option>name=comment</option><option>xpath=//textarea[@id='txt_comment']</option><option>xpath=//section[@id='appointment']/div/div/form/div[5]/div/textarea</option><option>xpath=(.//*[normalize-space(text()) and normalize-space(.)='Comment'])[1]/following::textarea[1]</option><option>xpath=(.//*[normalize-space(text()) and normalize-space(.)='Visit Date (Required)'])[1]/following::textarea[1]</option><option>xpath=(.//*[normalize-space(text()) and normalize-space(.)='Book Appointment'])[1]/preceding::textarea[1]</option><option>xpath=(.//*[normalize-space(text()) and normalize-space(.)='CURA Healthcare Service'])[3]/preceding::textarea[1]</option><option>xpath=//textarea</option><option>css=#txt_comment</option></datalist></td><td>`+ "${Comment}" + `</td></tr>
    <tr><td>click</td><td>id=btn-book-appointment<datalist><option>id=btn-book-appointment</option><option>xpath=//button[@id='btn-book-appointment']</option><option>xpath=//section[@id='appointment']/div/div/form/div[6]/div/button</option><option>xpath=(.//*[normalize-space(text()) and normalize-space(.)='Comment'])[1]/following::button[1]</option><option>xpath=(.//*[normalize-space(text()) and normalize-space(.)='Visit Date (Required)'])[1]/following::button[1]</option><option>xpath=(.//*[normalize-space(text()) and normalize-space(.)='CURA Healthcare Service'])[3]/preceding::button[1]</option><option>xpath=(.//*[normalize-space(text()) and normalize-space(.)='(678) 813-1KMS'])[1]/preceding::button[1]</option><option>xpath=//button</option><option>css=#btn-book-appointment</option></datalist></td><td></td></tr>
    <tr><td>click</td><td>id=menu-toggle<datalist><option>id=menu-toggle</option><option>xpath=//a[@id='menu-toggle']</option><option>xpath=(.//*[normalize-space(text()) and normalize-space(.)='CURA Healthcare'])[1]/preceding::a[2]</option><option>xpath=(.//*[normalize-space(text()) and normalize-space(.)='Home'])[1]/preceding::a[3]</option><option>xpath=//a[contains(@href, '#')]</option><option>xpath=//a</option><option>css=#menu-toggle</option></datalist></td><td></td></tr>
    <tr><td>click</td><td>link=Logout<datalist><option>link=Logout</option><option>xpath=//a[contains(text(),'Logout')]</option><option>xpath=//nav[@id='sidebar-wrapper']/ul/li[5]/a</option><option>xpath=(.//*[normalize-space(text()) and normalize-space(.)='Profile'])[1]/following::a[1]</option><option>xpath=(.//*[normalize-space(text()) and normalize-space(.)='History'])[1]/following::a[2]</option><option>xpath=(.//*[normalize-space(text()) and normalize-space(.)='CURA Healthcare Service'])[2]/preceding::a[1]</option><option>xpath=(.//*[normalize-space(text()) and normalize-space(.)='We Care About Your Health'])[1]/preceding::a[1]</option><option>xpath=//a[contains(@href, 'authenticate.php?logout')]</option><option>xpath=//li[5]/a</option></datalist></td><td></td></tr>
    <tr><td>endLoadVars</td><td><datalist></datalist></td><td></td></tr>
    </tbody></table>
    </body>
    </html>`,
    data: {
        "appointments.csv": {
            "content": "Comment",
            "type": "csv"
        }
    }
},
{
    testSuiteName: "Control flow",
    projectName: "Control flow",
    description: "Limited the manual steps. I kept the full use of control flow commands (while, if, endIf, endWhile) to demonstrate the capacity of control flow in KR.",
    testSuite: `<?xml version="1.0" encoding="UTF-8"?>
    <!DOCTYPE html PUBLIC "-//W3C//DTD XHTML 1.0 Strict//EN" "http://www.w3.org/TR/xhtml1/DTD/xhtml1-strict.dtd">
    <html xmlns="http://www.w3.org/1999/xhtml" xml:lang="en" lang="en">
    <head>
    <meta content="text/html; charset=UTF-8" http-equiv="content-type" />
    <title>Add items to cart and confirm</title>
    </head>
    <body>
    <table cellpadding="1" cellspacing="1" border="1">
    <thead>
    <tr><td rowspan="1" colspan="3" data-tags="">Add items to cart and confirm (manually)</td></tr>
    </thead>
    <tbody>
    <tr><td>open</td><td>https://cms.demo.katalon.com/<datalist><option>https://cms.demo.katalon.com/</option></datalist></td><td></td></tr>
    <tr><td>click</td><td>xpath=//main[@id='main']/div[2]/ul/li[1]/div/a[2]<datalist><option>link=Add to cart</option><option>xpath=//a[contains(text(),'Add to cart')]</option><option>xpath=//main[@id='main']/div[2]/ul/li/div/a[2]</option><option>xpath=(.//*[normalize-space(text()) and normalize-space(.)='Sale!'])[1]/following::a[1]</option><option>xpath=(.//*[normalize-space(text()) and normalize-space(.)='Default sorting'])[2]/following::a[2]</option><option>xpath=(.//*[normalize-space(text()) and normalize-space(.)='Flying Ninja'])[1]/preceding::a[1]</option><option>xpath=(.//*[normalize-space(text()) and normalize-space(.)='$'])[1]/preceding::a[1]</option><option>xpath=//*/text()[normalize-space(.)='Add to cart']/parent::*</option><option>xpath=//a[contains(@href, '?add-to-cart=54')]</option><option>xpath=//a[2]</option><option>css=a.button.product_type_simple.add_to_cart_button.ajax_add_to_cart</option><option>xpath=//main[@id='main']/div[2]/ul/li[2]/div/a[1]</option><option>xpath=//main[@id='main']/div[2]/ul/li[2]/div/a[2]</option><option>xpath=//main[@id='main']/div[2]/ul/li[1]/div/a[2]</option></datalist></td><td></td></tr>
    <tr><td>verifyText</td><td>xpath=//main[@id='main']/div[2]/ul/li[1]/div/a[3]<datalist><option>link=View cart</option><option>xpath=//a[contains(text(),'View cart')]</option><option>xpath=//main[@id='main']/div[2]/ul/li/div/a[3]</option><option>xpath=(.//*[normalize-space(text()) and normalize-space(.)='Add to cart'])[1]/following::a[1]</option><option>xpath=(.//*[normalize-space(text()) and normalize-space(.)='Sale!'])[1]/following::a[2]</option><option>xpath=(.//*[normalize-space(text()) and normalize-space(.)='Flying Ninja'])[1]/preceding::a[1]</option><option>xpath=(.//*[normalize-space(text()) and normalize-space(.)='$'])[1]/preceding::a[1]</option><option>xpath=//*/text()[normalize-space(.)='View cart']/parent::*</option><option>xpath=//a[3]</option><option>css=a.added_to_cart.wc-forward</option><option>xpath=//main[@id='main']/div[2]/ul/li[2]/div/a[3]</option><option>xpath=//main[@id='main']/div[2]/ul/li[1]/div/a[3]</option></datalist></td><td>View cart</td></tr>
    <tr><td>click</td><td>xpath=//main[@id='main']/div[2]/ul/li[2]/div/a[2]<datalist><option>xpath=//main[@id='main']/div[2]/ul/li[2]/div/a[2]</option><option>xpath=(.//*[normalize-space(text()) and normalize-space(.)='$'])[2]/following::a[2]</option><option>xpath=(.//*[normalize-space(text()) and normalize-space(.)='$'])[1]/following::a[2]</option><option>xpath=(.//*[normalize-space(text()) and normalize-space(.)='Happy Ninja'])[1]/preceding::a[1]</option><option>xpath=(.//*[normalize-space(text()) and normalize-space(.)='$'])[3]/preceding::a[1]</option><option>xpath=//a[contains(@href, '?add-to-cart=26')]</option><option>xpath=//li[2]/div/a[2]</option><option>css=li.product.type-product.post-26.status-publish.instock.product_cat-clothing.product_cat-t-shirts.has-post-thumbnail.taxable.shipping-taxable.purchasable.product-type-simple > div.ellie-thumb-wrapper > a.button.product_type_simple.add_to_cart_button.ajax_add_to_cart</option></datalist></td><td></td></tr>
    <tr><td>verifyText</td><td>xpath=//main[@id='main']/div[2]/ul/li[2]/div/a[3]<datalist><option>xpath=//main[@id='main']/div[2]/ul/li[2]/div/a[3]</option><option>xpath=(.//*[normalize-space(text()) and normalize-space(.)='Add to cart'])[2]/following::a[1]</option><option>xpath=(.//*[normalize-space(text()) and normalize-space(.)='$'])[2]/following::a[3]</option><option>xpath=(.//*[normalize-space(text()) and normalize-space(.)='Happy Ninja'])[1]/preceding::a[1]</option><option>xpath=(.//*[normalize-space(text()) and normalize-space(.)='$'])[3]/preceding::a[1]</option><option>xpath=//li[2]/div/a[3]</option><option>css=li.product.type-product.post-26.status-publish.instock.product_cat-clothing.product_cat-t-shirts.has-post-thumbnail.taxable.shipping-taxable.purchasable.product-type-simple > div.ellie-thumb-wrapper > a.added_to_cart.wc-forward</option></datalist></td><td>View cart</td></tr>
    <tr><td>click</td><td>xpath=//main[@id='main']/div[2]/ul/li[3]/div/a[2]<datalist><option>xpath=//main[@id='main']/div[2]/ul/li[3]/div/a[2]</option><option>xpath=(.//*[normalize-space(text()) and normalize-space(.)='$'])[3]/following::a[2]</option><option>xpath=(.//*[normalize-space(text()) and normalize-space(.)='Happy Ninja'])[1]/following::a[2]</option><option>xpath=(.//*[normalize-space(text()) and normalize-space(.)='Happy Ninja'])[2]/preceding::a[1]</option><option>xpath=(.//*[normalize-space(text()) and normalize-space(.)='$'])[4]/preceding::a[1]</option><option>xpath=//a[contains(@href, '?add-to-cart=27')]</option><option>xpath=//li[3]/div/a[2]</option><option>css=li.product.type-product.post-27.status-publish.last.instock.product_cat-clothing.product_cat-hoodies.has-post-thumbnail.taxable.shipping-taxable.purchasable.product-type-simple > div.ellie-thumb-wrapper > a.button.product_type_simple.add_to_cart_button.ajax_add_to_cart</option></datalist></td><td></td></tr>
    <tr><td>verifyText</td><td>xpath=//main[@id='main']/div[2]/ul/li[3]/div/a[3]<datalist><option>xpath=//main[@id='main']/div[2]/ul/li[3]/div/a[3]</option><option>xpath=(.//*[normalize-space(text()) and normalize-space(.)='Add to cart'])[3]/following::a[1]</option><option>xpath=(.//*[normalize-space(text()) and normalize-space(.)='$'])[3]/following::a[3]</option><option>xpath=(.//*[normalize-space(text()) and normalize-space(.)='Happy Ninja'])[2]/preceding::a[1]</option><option>xpath=(.//*[normalize-space(text()) and normalize-space(.)='$'])[4]/preceding::a[1]</option><option>xpath=//li[3]/div/a[3]</option><option>css=li.product.type-product.post-27.status-publish.last.instock.product_cat-clothing.product_cat-hoodies.has-post-thumbnail.taxable.shipping-taxable.purchasable.product-type-simple > div.ellie-thumb-wrapper > a.added_to_cart.wc-forward</option></datalist></td><td>View cart</td></tr>
    <tr><td>click</td><td>xpath=//main[@id='main']/div[2]/ul/li[4]/div/a[2]<datalist><option>xpath=//main[@id='main']/div[2]/ul/li[4]/div/a[2]</option><option>xpath=(.//*[normalize-space(text()) and normalize-space(.)='$'])[4]/following::a[2]</option><option>xpath=(.//*[normalize-space(text()) and normalize-space(.)='Happy Ninja'])[2]/following::a[2]</option><option>xpath=(.//*[normalize-space(text()) and normalize-space(.)='Ninja Silhouette'])[1]/preceding::a[1]</option><option>xpath=(.//*[normalize-space(text()) and normalize-space(.)='$'])[5]/preceding::a[1]</option><option>xpath=//a[contains(@href, '?add-to-cart=25')]</option><option>xpath=//li[4]/div/a[2]</option><option>css=li.product.type-product.post-25.status-publish.first.instock.product_cat-clothing.product_cat-t-shirts.has-post-thumbnail.taxable.shipping-taxable.purchasable.product-type-simple > div.ellie-thumb-wrapper > a.button.product_type_simple.add_to_cart_button.ajax_add_to_cart</option></datalist></td><td></td></tr>
    <tr><td>verifyText</td><td>xpath=//main[@id='main']/div[2]/ul/li[4]/div/a[3]<datalist><option>xpath=//main[@id='main']/div[2]/ul/li[4]/div/a[3]</option><option>xpath=(.//*[normalize-space(text()) and normalize-space(.)='Add to cart'])[4]/following::a[1]</option><option>xpath=(.//*[normalize-space(text()) and normalize-space(.)='$'])[4]/following::a[3]</option><option>xpath=(.//*[normalize-space(text()) and normalize-space(.)='Ninja Silhouette'])[1]/preceding::a[1]</option><option>xpath=(.//*[normalize-space(text()) and normalize-space(.)='$'])[5]/preceding::a[1]</option><option>xpath=//li[4]/div/a[3]</option><option>css=li.product.type-product.post-25.status-publish.first.instock.product_cat-clothing.product_cat-t-shirts.has-post-thumbnail.taxable.shipping-taxable.purchasable.product-type-simple > div.ellie-thumb-wrapper > a.added_to_cart.wc-forward</option></datalist></td><td>View cart</td></tr>
    <tr><td>click</td><td>xpath=//main[@id='main']/div[2]/ul/li[6]/div/a[2]<datalist><option>xpath=//main[@id='main']/div[2]/ul/li[6]/div/a[2]</option><option>xpath=(.//*[normalize-space(text()) and normalize-space(.)='$'])[6]/following::a[2]</option><option>xpath=(.//*[normalize-space(text()) and normalize-space(.)='Ninja Silhouette'])[2]/following::a[2]</option><option>xpath=(.//*[normalize-space(text()) and normalize-space(.)='Patient Ninja'])[1]/preceding::a[1]</option><option>xpath=(.//*[normalize-space(text()) and normalize-space(.)='$'])[7]/preceding::a[1]</option><option>xpath=//a[contains(@href, '?add-to-cart=66')]</option><option>xpath=//li[6]/div/a[2]</option><option>css=li.product.type-product.post-66.status-publish.last.instock.product_cat-clothing.product_cat-hoodies.has-post-thumbnail.taxable.shipping-taxable.purchasable.product-type-simple > div.ellie-thumb-wrapper > a.button.product_type_simple.add_to_cart_button.ajax_add_to_cart</option></datalist></td><td></td></tr>
    <tr><td>verifyText</td><td>xpath=//main[@id='main']/div[2]/ul/li[6]/div/a[3]<datalist><option>xpath=//main[@id='main']/div[2]/ul/li[6]/div/a[3]</option><option>xpath=(.//*[normalize-space(text()) and normalize-space(.)='Add to cart'])[5]/following::a[1]</option><option>xpath=(.//*[normalize-space(text()) and normalize-space(.)='$'])[6]/following::a[3]</option><option>xpath=(.//*[normalize-space(text()) and normalize-space(.)='Patient Ninja'])[1]/preceding::a[1]</option><option>xpath=(.//*[normalize-space(text()) and normalize-space(.)='$'])[7]/preceding::a[1]</option><option>xpath=//li[6]/div/a[3]</option><option>css=li.product.type-product.post-66.status-publish.last.instock.product_cat-clothing.product_cat-hoodies.has-post-thumbnail.taxable.shipping-taxable.purchasable.product-type-simple > div.ellie-thumb-wrapper > a.added_to_cart.wc-forward</option></datalist></td><td>View cart</td></tr>
    <tr><td>click</td><td>xpath=//main[@id='main']/div[2]/ul/li[7]/div/a[2]<datalist><option>xpath=//main[@id='main']/div[2]/ul/li[7]/div/a[2]</option><option>xpath=(.//*[normalize-space(text()) and normalize-space(.)='$'])[7]/following::a[2]</option><option>xpath=(.//*[normalize-space(text()) and normalize-space(.)='Patient Ninja'])[1]/following::a[2]</option><option>xpath=(.//*[normalize-space(text()) and normalize-space(.)='Premium Quality'])[1]/preceding::a[1]</option><option>xpath=(.//*[normalize-space(text()) and normalize-space(.)='$'])[8]/preceding::a[1]</option><option>xpath=//a[contains(@href, '?add-to-cart=22')]</option><option>xpath=//li[7]/div/a[2]</option><option>css=li.product.type-product.post-22.status-publish.first.instock.product_cat-clothing.product_cat-t-shirts.has-post-thumbnail.taxable.shipping-taxable.purchasable.product-type-simple > div.ellie-thumb-wrapper > a.button.product_type_simple.add_to_cart_button.ajax_add_to_cart</option></datalist></td><td></td></tr>
    <tr><td>verifyText</td><td>xpath=//main[@id='main']/div[2]/ul/li[7]/div/a[3]<datalist><option>xpath=//main[@id='main']/div[2]/ul/li[7]/div/a[3]</option><option>xpath=(.//*[normalize-space(text()) and normalize-space(.)='Add to cart'])[6]/following::a[1]</option><option>xpath=(.//*[normalize-space(text()) and normalize-space(.)='$'])[7]/following::a[3]</option><option>xpath=(.//*[normalize-space(text()) and normalize-space(.)='Premium Quality'])[1]/preceding::a[1]</option><option>xpath=(.//*[normalize-space(text()) and normalize-space(.)='$'])[8]/preceding::a[1]</option><option>xpath=//li[7]/div/a[3]</option><option>css=li.product.type-product.post-22.status-publish.first.instock.product_cat-clothing.product_cat-t-shirts.has-post-thumbnail.taxable.shipping-taxable.purchasable.product-type-simple > div.ellie-thumb-wrapper > a.added_to_cart.wc-forward</option></datalist></td><td>View cart</td></tr>
    <tr><td>click</td><td>xpath=//main[@id='main']/div[2]/ul/li[8]/div/a[2]<datalist><option>xpath=//main[@id='main']/div[2]/ul/li[8]/div/a[2]</option><option>xpath=(.//*[normalize-space(text()) and normalize-space(.)='Sale!'])[2]/following::a[1]</option><option>xpath=(.//*[normalize-space(text()) and normalize-space(.)='$'])[8]/following::a[2]</option><option>xpath=(.//*[normalize-space(text()) and normalize-space(.)='Premium Quality'])[2]/preceding::a[1]</option><option>xpath=(.//*[normalize-space(text()) and normalize-space(.)='$'])[9]/preceding::a[1]</option><option>xpath=//a[contains(@href, '?add-to-cart=51')]</option><option>xpath=//li[8]/div/a[2]</option><option>css=li.product.type-product.post-51.status-publish.instock.product_cat-posters.has-post-thumbnail.sale.taxable.shipping-taxable.purchasable.product-type-simple > div.ellie-thumb-wrapper > a.button.product_type_simple.add_to_cart_button.ajax_add_to_cart</option></datalist></td><td></td></tr>
    <tr><td>verifyText</td><td>xpath=//main[@id='main']/div[2]/ul/li[8]/div/a[3]<datalist><option>xpath=//main[@id='main']/div[2]/ul/li[8]/div/a[3]</option><option>xpath=(.//*[normalize-space(text()) and normalize-space(.)='Add to cart'])[7]/following::a[1]</option><option>xpath=(.//*[normalize-space(text()) and normalize-space(.)='Sale!'])[2]/following::a[2]</option><option>xpath=(.//*[normalize-space(text()) and normalize-space(.)='Premium Quality'])[2]/preceding::a[1]</option><option>xpath=(.//*[normalize-space(text()) and normalize-space(.)='$'])[9]/preceding::a[1]</option><option>xpath=//li[8]/div/a[3]</option><option>css=li.product.type-product.post-51.status-publish.instock.product_cat-posters.has-post-thumbnail.sale.taxable.shipping-taxable.purchasable.product-type-simple > div.ellie-thumb-wrapper > a.added_to_cart.wc-forward</option></datalist></td><td>View cart</td></tr>
    <tr><td>click</td><td>xpath=//main[@id='main']/div[2]/ul/li[11]/div/a[2]<datalist><option>xpath=//main[@id='main']/div[2]/ul/li[11]/div/a[2]</option><option>xpath=(.//*[normalize-space(text()) and normalize-space(.)='$'])[13]/following::a[2]</option><option>xpath=(.//*[normalize-space(text()) and normalize-space(.)='$'])[12]/following::a[2]</option><option>xpath=(.//*[normalize-space(text()) and normalize-space(.)='Ship Your Idea'])[3]/preceding::a[1]</option><option>xpath=(.//*[normalize-space(text()) and normalize-space(.)='$'])[14]/preceding::a[1]</option><option>xpath=//a[contains(@href, '?add-to-cart=57')]</option><option>xpath=//li[11]/div/a[2]</option><option>css=li.product.type-product.post-57.status-publish.instock.product_cat-posters.has-post-thumbnail.taxable.shipping-taxable.purchasable.product-type-simple > div.ellie-thumb-wrapper > a.button.product_type_simple.add_to_cart_button.ajax_add_to_cart</option></datalist></td><td></td></tr>
    <tr><td>verifyText</td><td>xpath=//main[@id='main']/div[2]/ul/li[11]/div/a[3]<datalist><option>xpath=//main[@id='main']/div[2]/ul/li[11]/div/a[3]</option><option>xpath=(.//*[normalize-space(text()) and normalize-space(.)='Add to cart'])[8]/following::a[1]</option><option>xpath=(.//*[normalize-space(text()) and normalize-space(.)='$'])[13]/following::a[3]</option><option>xpath=(.//*[normalize-space(text()) and normalize-space(.)='Ship Your Idea'])[3]/preceding::a[1]</option><option>xpath=(.//*[normalize-space(text()) and normalize-space(.)='$'])[14]/preceding::a[1]</option><option>xpath=//li[11]/div/a[3]</option><option>css=li.product.type-product.post-57.status-publish.instock.product_cat-posters.has-post-thumbnail.taxable.shipping-taxable.purchasable.product-type-simple > div.ellie-thumb-wrapper > a.added_to_cart.wc-forward</option></datalist></td><td>View cart</td></tr>
    <tr><td>click</td><td>xpath=//main[@id='main']/div[2]/ul/li[12]/div/a[2]<datalist><option>xpath=//main[@id='main']/div[2]/ul/li[12]/div/a[2]</option><option>xpath=(.//*[normalize-space(text()) and normalize-space(.)='$'])[14]/following::a[2]</option><option>xpath=(.//*[normalize-space(text()) and normalize-space(.)='Ship Your Idea'])[3]/following::a[2]</option><option>xpath=(.//*[normalize-space(text()) and normalize-space(.)='Woo Album #1'])[1]/preceding::a[1]</option><option>xpath=(.//*[normalize-space(text()) and normalize-space(.)='$'])[15]/preceding::a[1]</option><option>xpath=//a[contains(@href, '?add-to-cart=15')]</option><option>xpath=//li[12]/div/a[2]</option><option>css=li.product.type-product.post-15.status-publish.last.instock.product_cat-albums.product_cat-music.has-post-thumbnail.virtual.taxable.purchasable.product-type-simple > div.ellie-thumb-wrapper > a.button.product_type_simple.add_to_cart_button.ajax_add_to_cart</option></datalist></td><td></td></tr>
    <tr><td>verifyText</td><td>xpath=//main[@id='main']/div[2]/ul/li[12]/div/a[3]<datalist><option>xpath=//main[@id='main']/div[2]/ul/li[12]/div/a[3]</option><option>xpath=(.//*[normalize-space(text()) and normalize-space(.)='Add to cart'])[9]/following::a[1]</option><option>xpath=(.//*[normalize-space(text()) and normalize-space(.)='$'])[14]/following::a[3]</option><option>xpath=(.//*[normalize-space(text()) and normalize-space(.)='Woo Album #1'])[1]/preceding::a[1]</option><option>xpath=(.//*[normalize-space(text()) and normalize-space(.)='$'])[15]/preceding::a[1]</option><option>xpath=//li[12]/div/a[3]</option><option>css=li.product.type-product.post-15.status-publish.last.instock.product_cat-albums.product_cat-music.has-post-thumbnail.virtual.taxable.purchasable.product-type-simple > div.ellie-thumb-wrapper > a.added_to_cart.wc-forward</option></datalist></td><td>View cart</td></tr>
    </tbody></table>
    <table cellpadding="1" cellspacing="1" border="1">
    <thead>
    <tr><td rowspan="1" colspan="3" data-tags="">Add items to cart and confirm (with control flow)</td></tr>
    </thead>
    <tbody>
    <tr><td>open</td><td>https://cms.demo.katalon.com<datalist><option>https://cms.demo.katalon.com</option></datalist></td><td></td></tr>
    <tr><td>store</td><td>1<datalist><option>1</option></datalist></td><td>index</td></tr>
    <tr><td>while</td><td>`+ "${index}" + ` < 13<datalist><option>` + "${index}" + ` < 13</option></datalist></td><td></td></tr>
    <tr><td>storeText</td><td>xpath=//main[@id='main']/div[2]/ul/li[`+ "${index}" + `]/div/a[2]<datalist><option>xpath=//main[@id='main']/div[2]/ul/li[` + "${ID}" + `]/div/a[2]</option><option>xpath=//main[@id='main']/div[2]/ul/li[` + "${index}" + `]/div/a[2]</option></datalist></td><td>itemText</td></tr>
    <tr><td>if</td><td>`+ "${itemText}" + ` == "Add to cart"<datalist><option>` + "${itemText}" + ` == "Add to cart"</option></datalist></td><td></td></tr>
    <tr><td>click</td><td>xpath=//main[@id='main']/div[2]/ul/li[`+ "${index}" + `]/div/a[2]<datalist><option>xpath=//main[@id='main']/div[2]/ul/li[` + "${ID}" + `]/div/a[2]</option><option>xpath=//main[@id='main']/div[2]/ul/li[` + "${index}" + `]/div/a[2]</option></datalist></td><td></td></tr>
    <tr><td>pause</td><td><datalist></datalist></td><td>1000</td></tr>
    <tr><td>verifyText</td><td>xpath=//main[@id='main']/div[2]/ul/li[`+ "${index}" + `]/div/a[3]<datalist><option>xpath=//main[@id='main']/div[2]/ul/li[` + "${index}" + `]/div/a[3]</option></datalist></td><td>View cart</td></tr>
    <tr><td>endIf</td><td><datalist></datalist></td><td></td></tr>
    <tr><td>storeEval</td><td>`+ "${index}" + ` + 1<datalist><option>` + "${index}" + ` + 1</option></datalist></td><td>index</td></tr>
    <tr><td>endWhile</td><td><datalist></datalist></td><td></td></tr>
    </tbody></table>
    </body>
    </html>`
}
]

export { sampleData }