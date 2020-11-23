import html
import os
from urllib.parse import urlencode
from flask import redirect, make_response, Response
from sendgrid import SendGridAPIClient
from python_http_client.exceptions import HTTPError

def preflight(request):
    if request.method == 'OPTIONS':
        return ("", 204, {
            "Access-Control-Allow-Origin": "*",
            "Access-Control-Allow-Methods": "GET,POST",
            "Access-Control-Allow-Headers": request.headers["Access-Control-Request-Headers"],
            "Access-Control-Max-Age": "3600"
        })

    rv = email(request)
    response = make_response(rv)
    response.headers.set("Access-Control-Allow-Origin", "*")
    return response

def email(request):
    isXHR = request.headers.get("X-Requested-With") == "XMLHttpRequest"

    try:
        sg = SendGridAPIClient(os.environ['SENDGRID_API_KEY'])

        if isXHR and request.is_json:
            body = request.get_json()
            lang = body["er-lang"]
            referrer = body["er-referrer"]
            name = body["er-name"]
            email = body["er-email"]
        elif request.mimetype == "multipart/form-data" or request.mimetype == "application/x-www-form-urlencoded":
            lang = request.form["er-lang"]
            referrer = request.form["er-referrer"]
            name = request.form["er-name"]
            email = request.form["er-email"]
        else:
            raise ValueError("Mismatched mimetype")

        data = {
            "personalizations": [
                {
                    "to": [
                        {
                            "email": "christian@firstgenfirst.org"
                        }
                    ],
                    "subject": "New Notification Subscription"
                }
            ],
            "from": {
                "email": "formsubmissions@firstgenfirst.org",
                "name": "FGF Form Submissions"
            },
            "reply_to": {
                "email": "info@firstgenfirst.org"
            },
            "content": email_contents({
                "Name": name,
                "Email": email
            }, referrer=request.referrer or referrer, lang=lang)
        }

        response = sg.client.mail.send.post(request_body=data)

        metadata = {
            "status": response.status_code
        }
        if isXHR:
            return Response(str(metadata), response.status_code, mimetype="application/json")
        else:
            return redirect("https://firstgenfirst.org/formsubmitted?" + urlencode(metadata))
    except HTTPError as e:
        metadata = {
            "status": 500,
            "message": e.reason if hasattr(e, "reason") else str(e)
        }
        if isXHR:
            return Response(str(metadata), status=500, mimetype="application/json")
        else:
            return redirect("https://firstgenfirst.org/formerror?" + urlencode(metadata));
    except Exception as e:
        metadata = {
            "status": 500,
            "message": e.message if hasattr(e, "message") else str(e)
        }
        if isXHR:
            return Response(str(metadata), status=500, mimetype="application/json")
        else:
            return redirect("https://firstgenfirst.org/formerror?" + urlencode(metadata));

def email_contents(params, referrer="", lang=None):
    lang = {
        "en": "English",
        "es": "Spanish"
    }.get(lang, None)
    text_content = "Someone just submitted a form.\nHere's what it said:\n"
    html_content = """
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
             </tr>"""
    for key in params.keys():
        if key == "referrer":
            continue
        text_content += "\n{}: {}".format(key, params[key] if params[key] != "" else "[no value]")
        html_content += """
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
                          <td style="padding:0.2em 0.5em;Margin:0;background-color:#EEEEEE;border-top-right-radius:inherit;border-top-left-radius:inherit"><h2 style="Margin:0;line-height:120%;mso-line-height-rule:exactly;font-family:inherit;font-size:1.2rem;font-style:normal;font-weight:400;color:#333333">{}</h2></td>
                         </tr>
                         <tr style="border-collapse:collapse;border-bottom-right-radius:inherit;border-bottom-left-radius:inherit">
                          <td style="padding:0.2em 0.5em;Margin:0;border-bottom-right-radius:inherit;border-bottom-left-radius:inherit"><p style="Margin:0;-webkit-text-size-adjust:none;-ms-text-size-adjust:none;mso-line-height-rule:exactly;font-size:14px;font-family:inherit;line-height:21px;color:#333333;font-weight:inherit">{}</p></td>
                         </tr>
                       </table></td>
                     </tr>
                   </table></td>
                 </tr>
               </table></td>
             </tr>""".format(key, html.escape(params[key]) if params[key] != "" else "[<span style='font-style:italic'>no value</span>]")
    
    text_content += "\n\nThis form was submitted from {}.".format(referrer if referrer != "" else "[unknown]")
    html_content += """
             <tr style="border-collapse:collapse">
              <td align="left" style="padding:20px;Margin:0">
               <table cellpadding="0" cellspacing="0" width="100%" style="mso-table-lspace:0pt;mso-table-rspace:0pt;border-collapse:collapse;border-spacing:0px">
                 <tr style="border-collapse:collapse">
                  <td align="center" valign="top" style="padding:0;Margin:0;width:560px">
                   <table cellpadding="0" cellspacing="0" width="100%" role="presentation" style="mso-table-lspace:0pt;mso-table-rspace:0pt;border-collapse:collapse;border-spacing:0px">
                     <tr style="border-collapse:collapse">
                      <td style="padding:0;Margin:0"><span style="text-align:center;font-family:'Helvetica Neue', Helvetica, Arial, Verdana, sans-serif;font-weight:300;font-size:0.8rem">This form was submmitted from {} (Language: {}).</span></td>
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
</html>""".format(html.escape(referrer) if referrer != "" else "[<span style='font-style:italic'>unknown</span>]", lang or "[<span style='font-style:italic'>unset</span>]")

    value = [
        {
            "type": "text/plain",
            "value": text_content
        },
        {
            "type": "text/html",
            "value": html_content
        }
    ]
    return value