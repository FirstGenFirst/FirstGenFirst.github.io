// This script is used by Google Cloud Functions to handle Contact Us form submissions.
// It uses GMAIL_USERNAME and GMAIL_PASSWORD environment variables for credentials.

const nodemailer = require("nodemailer");

exports.email = (req, res) => {
  const USERNAME = process.env.GMAIL_USERNAME;
  const PASSWORD = process.env.GMAIL_PASSWORD;

  res.set("Access-Control-Allow-Origin", "*");

  const SUCCESSFUL_FORM = {
    en: "https://firstgenfirst.org/formsubmitted",
    es: "https://firstgenfirst.org/formularioenviado"
  };
  const ERRORED_FORM = {
    en: "https://firstgenfirst.org/formerror",
    es: "https://firstgenfirst.org/formularioerror"
  };

  function fail(status, description, value, lang) {
    const METADATA = {
      status: status,
      description: description,
      value: value,
      input: req.body
    };
    if (req.xhr) {
      res.status(status).json(METADATA);
    } else {
      res.redirect(ERRORED_FORM[lang] + "?metadata=" + encodeURIComponent(JSON.stringify(METADATA)))
    }
  }

  function succeed(status, description, value, lang) {
    const METADATA = {
      status: status,
      description: description,
      value: value,
      input: req.body
    };
    if (req.xhr) {
      res.status(status).json(METADATA);
    } else {
      res.redirect(SUCCESSFUL_FORM[lang] + "?metadata=" + encodeURIComponent(JSON.stringify(METADATA)))
    }
  }

  if (req.method == "OPTIONS") {
    // Send response to OPTIONS requests
    res.set("Access-Control-Allow-Methods", "POST");
    res.set("Access-Control-Allow-Headers", "*");
    res.set("Access-Control-Max-Age", "3600");
    res.status(204).send("");
  } else {
    let body;

    switch (req.accepts(["application/x-www-form-urlencoded", "application/json"])) {
      case "application/json":
        body = typeof req.body == "string" ? JSON.parse(req.body) : req.body;
        break;
      case "application/x-www-form-urlencoded":
        if (typeof req.body == "string") {
          try {
            const querystring = require("querystring");
            body = querystring.parse(req.body);
          } catch (e) {
            return fail(500, "Malformed data", req.body, "en");
          }
        } else {
          body = req.body;
        }
        break;
      case false:
      default:
        const type = req.get("Content-Type");
        return fail(406, `Invalid content type: ${type}`, type, "en");
    }

    const name = body.name;
    const email = body.email;
    const message = body.message;
    const lang = body.lang;
    const path = body.path;

    console.log(JSON.stringify({
      severity: "INFO",
      message: `Submission received from ${name} <${email}>.`,
      submission: {
        name: name,
        email: email,
        message: message,
        lang: lang,
        path: path
      }
    }));

    if (typeof name != "string" || typeof email != "string" || typeof message != "string") {
      return fail(500, "Improper component (name, email, and message must all be strings)", body, lang);
    }

    const transporter = nodemailer.createTransport({
      service: "gmail",
      auth: {
        user: USERNAME,
        pass: PASSWORD
      }
    });

    const mailOptions = {
      from: {
        name: "FGF Form Submissions",
        address: "formsubmissions@firstgenfirst.org"
      },
      to: "info@firstgenfirst.org",
      subject: "New Contact Us Submission",
      text: text_content(
        {
          Name: name,
          Email: email,
          Message: message
        },
        typeof path == "string" ? "https://firstgenfirst.org" + path : req.get("Referer"),
        lang
      ),
      html: html_content(
        {
          Name: name,
          Email: email,
          Message: message
        },
        typeof path == "string" ? "https://firstgenfirst.org" + path : req.get("Referer"),
        lang
      )
    };

    transporter.sendMail(mailOptions, function(err, info) {
      if (err)
        fail(500, "Error sending email", err, lang);
      else
        succeed(200, "OK", info, lang);
    });
  }
};


function text_content(params, referrer, lang) {
  let text_content = "Someone just submitted a form.\nHere's what it said:\n";
  for (const key of Object.keys(params)) {
    if (key == "referrer") {
      continue;
    }
    text_content += `\n${key}: ${params[key] == "" ? "[no value]" : params[key]}`;
  }
  text_content += `\n\nThis form was submitted from ${referrer || "[unknown]"} (Language: ${({en: "English", es: "Spanish"})[lang] || "[unset]"})`;

  return text_content;
}

function html_content(params, referrer, lang) {
  let html_content = `
<!DOCTYPE html PUBLIC "-//W3C//DTD XHTML 1.0 Transitional//EN" "http://www.w3.org/TR/xhtml1/DTD/xhtml1-transitional.dtd">
<html xmlns="http://www.w3.org/1999/xhtml" xmlns:o="urn:schemas-microsoft-com:office:office" style="width:100%;font-family:arial, 'helvetica neue', helvetica, sans-serif;-webkit-text-size-adjust:100%;-ms-text-size-adjust:100%;padding:0;Margin:0">
 <head>
  <meta charset="UTF-8">
  <meta content="width=device-width, initial-scale=1" name="viewport">
  <meta name="x-apple-disable-message-reformatting">
  <meta http-equiv="X-UA-Compatible" content="IE=edge">
  <meta content="telephone=no" name="format-detection">
  <title>New email</title>
  <!--[if (mso 16)]>
    <style type="text/css">
    a {text-decoration: none;}
    </style>
    <![endif]-->
  <!--[if gte mso 9]><style>sup { font-size: 100% !important; }</style><![endif]-->
  <!--[if gte mso 9]>
<xml>
    <o:OfficeDocumentSettings>
    <o:AllowPNG></o:AllowPNG>
    <o:PixelsPerInch>96</o:PixelsPerInch>
    </o:OfficeDocumentSettings>
</xml>
<![endif]-->
  <style type="text/css">
#outlook a {
  padding:0;
}
.ExternalClass {
  width:100%;
}
.ExternalClass,
.ExternalClass p,
.ExternalClass span,
.ExternalClass font,
.ExternalClass td,
.ExternalClass div {
  line-height:100%;
}
.es-button {
  mso-style-priority:100!important;
  text-decoration:none!important;
}
a[x-apple-data-detectors] {
  color:inherit!important;
  text-decoration:none!important;
  font-size:inherit!important;
  font-family:inherit!important;
  font-weight:inherit!important;
  line-height:inherit!important;
}
.es-desk-hidden {
  display:none;
  float:left;
  overflow:hidden;
  width:0;
  max-height:0;
  line-height:0;
  mso-hide:all;
}
@media only screen and (max-width:600px) {p, ul li, ol li, a { font-size:16px!important; line-height:150%!important } h1 { font-size:30px!important; text-align:center; line-height:120%!important } h2 { font-size:26px!important; text-align:center; line-height:120%!important } h3 { font-size:20px!important; text-align:center; line-height:120%!important } h1 a { font-size:30px!important } h2 a { font-size:26px!important } h3 a { font-size:20px!important } .es-menu td a { font-size:16px!important } .es-header-body p, .es-header-body ul li, .es-header-body ol li, .es-header-body a { font-size:16px!important } .es-footer-body p, .es-footer-body ul li, .es-footer-body ol li, .es-footer-body a { font-size:16px!important } .es-infoblock p, .es-infoblock ul li, .es-infoblock ol li, .es-infoblock a { font-size:12px!important } *[class="gmail-fix"] { display:none!important } .es-m-txt-c, .es-m-txt-c h1, .es-m-txt-c h2, .es-m-txt-c h3 { text-align:center!important } .es-m-txt-r, .es-m-txt-r h1, .es-m-txt-r h2, .es-m-txt-r h3 { text-align:right!important } .es-m-txt-l, .es-m-txt-l h1, .es-m-txt-l h2, .es-m-txt-l h3 { text-align:left!important } .es-m-txt-r img, .es-m-txt-c img, .es-m-txt-l img { display:inline!important } .es-button-border { display:block!important } a.es-button { font-size:20px!important; display:block!important; border-width:10px 0px 10px 0px!important } .es-btn-fw { border-width:10px 0px!important; text-align:center!important } .es-adaptive table, .es-btn-fw, .es-btn-fw-brdr, .es-left, .es-right { width:100%!important } .es-content table, .es-header table, .es-footer table, .es-content, .es-footer, .es-header { width:100%!important; max-width:600px!important } .es-adapt-td { display:block!important; width:100%!important } .adapt-img { width:100%!important; height:auto!important } .es-m-p0 { padding:0px!important } .es-m-p0r { padding-right:0px!important } .es-m-p0l { padding-left:0px!important } .es-m-p0t { padding-top:0px!important } .es-m-p0b { padding-bottom:0!important } .es-m-p20b { padding-bottom:20px!important } .es-mobile-hidden, .es-hidden { display:none!important } tr.es-desk-hidden, td.es-desk-hidden, table.es-desk-hidden { width:auto!important; overflow:visible!important; float:none!important; max-height:inherit!important; line-height:inherit!important } tr.es-desk-hidden { display:table-row!important } table.es-desk-hidden { display:table!important } td.es-desk-menu-hidden { display:table-cell!important } .es-menu td { width:1%!important } table.es-table-not-adapt, .esd-block-html table { width:auto!important } table.es-social { display:inline-block!important } table.es-social td { display:inline-block!important } }
</style>
 </head>
 <body style="width:100%;font-family:arial, 'helvetica neue', helvetica, sans-serif;-webkit-text-size-adjust:100%;-ms-text-size-adjust:100%;padding:0;Margin:0">
  <div class="es-wrapper-color" style="background-color:#F6F6F6">
   <!--[if gte mso 9]>
      <v:background xmlns:v="urn:schemas-microsoft-com:vml" fill="t">
        <v:fill type="tile" color="#f6f6f6"></v:fill>
      </v:background>
    <![endif]-->
   <table class="es-wrapper" width="100%" cellspacing="0" cellpadding="0" style="mso-table-lspace:0pt;mso-table-rspace:0pt;border-collapse:collapse;border-spacing:0px;padding:0;Margin:0;width:100%;height:100%;background-repeat:repeat;background-position:center top">
     <tr style="border-collapse:collapse">
      <td valign="top" style="padding:0;Margin:0">
       <table class="es-content" cellspacing="0" cellpadding="0" align="center" style="mso-table-lspace:0pt;mso-table-rspace:0pt;border-collapse:collapse;border-spacing:0px;table-layout:fixed !important;width:100%">
         <tr style="border-collapse:collapse">
          <td align="center" style="padding:0;Margin:0">
           <table class="es-content-body" cellspacing="0" cellpadding="0" bgcolor="#ffffff" align="center" style="mso-table-lspace:0pt;mso-table-rspace:0pt;border-collapse:collapse;border-spacing:0px;background-color:#FFFFFF;width:600px">
             <tr style="border-collapse:collapse">
              <td align="left" style="padding:0;Margin:0;padding-top:20px;padding-left:20px;padding-right:20px">
               <table width="100%" cellspacing="0" cellpadding="0" style="mso-table-lspace:0pt;mso-table-rspace:0pt;border-collapse:collapse;border-spacing:0px">
                 <tr style="border-collapse:collapse">
                  <td valign="top" align="center" style="padding:0;Margin:0;width:560px">
                   <table width="100%" cellspacing="0" cellpadding="0" role="presentation" style="mso-table-lspace:0pt;mso-table-rspace:0pt;border-collapse:collapse;border-spacing:0px">
                     <tr style="border-collapse:collapse">
                      <td style="padding:0;Margin:0">
                       <h1 style="Margin:0;line-height:120%;mso-line-height-rule:exactly;font-family:'Helvetica Neue', Helvetica, Arial, Verdana, sans-serif;font-size:1.7rem;font-style:normal;font-weight:300;color:#333333;text-align:center;margin-bottom:0.2rem">Someone just submitted a form</h1>
                       <h2 style="Margin:0;line-height:120%;mso-line-height-rule:exactly;font-family:'Helvetica Neue', Helvetica, Arial, Verdana, sans-serif;font-size:1.1rem;font-style:normal;font-weight:400;color:#333333;text-align:center;color:#01579B">Here's what it said</h2>
                      </td>
                     </tr>
                   </table></td>
                 </tr>
               </table></td>
             </tr>`;

  for (const key of Object.keys(params)) {
    if (key == "referrer") {
      continue;
    }
    html_content += `
             <tr style="border-collapse:collapse">
              <td align="left" style="padding:0;Margin:0;padding-top:20px;padding-left:20px;padding-right:20px">
               <table cellpadding="0" cellspacing="0" width="100%" style="mso-table-lspace:0pt;mso-table-rspace:0pt;border-collapse:collapse;border-spacing:0px">
                 <tr style="border-collapse:collapse">
                  <td align="center" valign="top" style="padding:0;Margin:0;width:560px">
                   <table cellpadding="0" cellspacing="0" width="100%" role="presentation" style="mso-table-lspace:0pt;mso-table-rspace:0pt;border-collapse:collapse;border-spacing:0px">
                     <tr style="border-collapse:collapse">
                      <td style="padding:0;Margin:0">
                       <table style="mso-table-lspace:0pt;mso-table-rspace:0pt;border-collapse:collapse;border-spacing:0px;table-layout:fixed;width:100%;font-family:'Helvetica Neue', Helvetica, Arial, Verdana, sans-serif;font-weight:300;box-shadow:0 0.2em 0.3em#777777;border-radius:0.2em" role="presentation">
                        <tbody style="border-radius:inherit">
                         <tr style="border-collapse:collapse;border-bottom:3px solid #0288D1;border-top-right-radius:inherit;border-top-left-radius:inherit">
                          <td style="padding:0.2em 0.5em;Margin:0;background-color:#EEEEEE;border-top-right-radius:inherit;border-top-left-radius:inherit"><h2 style="Margin:0;line-height:120%;mso-line-height-rule:exactly;font-family:inherit;font-size:1.2rem;font-style:normal;font-weight:400;color:#333333">${key}</h2></td>
                         </tr>
                         <tr style="border-collapse:collapse;border-bottom-right-radius:inherit;border-bottom-left-radius:inherit">
                          <td style="padding:0.2em 0.5em;Margin:0;border-bottom-right-radius:inherit;border-bottom-left-radius:inherit"><p style="Margin:0;-webkit-text-size-adjust:none;-ms-text-size-adjust:none;mso-line-height-rule:exactly;font-size:14px;font-family:inherit;line-height:21px;color:#333333;font-weight:inherit">${params[key] ? params[key].toString().replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;").replace(/'/g, "&#039;") : "[<span style='font-style:italic'>no value</span>]"}</p></td>
                         </tr>
                       </table></td>
                     </tr>
                   </table></td>
                 </tr>
               </table></td>
             </tr>`;
  }
  html_content += `
             <tr style="border-collapse:collapse">
              <td align="left" style="padding:20px;Margin:0">
               <table cellpadding="0" cellspacing="0" width="100%" style="mso-table-lspace:0pt;mso-table-rspace:0pt;border-collapse:collapse;border-spacing:0px">
                 <tr style="border-collapse:collapse">
                  <td align="center" valign="top" style="padding:0;Margin:0;width:560px">
                   <table cellpadding="0" cellspacing="0" width="100%" role="presentation" style="mso-table-lspace:0pt;mso-table-rspace:0pt;border-collapse:collapse;border-spacing:0px">
                     <tr style="border-collapse:collapse">
                      <td style="padding:0;Margin:0"><span style="text-align:center;font-family:'Helvetica Neue', Helvetica, Arial, Verdana, sans-serif;font-weight:300;font-size:0.8rem">This form was submmitted from ${referrer ? referrer.toString().replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;").replace(/'/g, "&#039;") : "[<span style='font-style:italic'>unknown</span>]"} (Language: ${({en: "English", es: "Spanish"})[lang] || "[unset]"}).</span></td>
                     </tr>
                   </table></td>
                 </tr>
               </table></td>
             </tr>
           </table></td>
         </tr>
       </table></td>
     </tr>
   </table>
  </div>
 </body>
</html>`;

  return html_content;
}