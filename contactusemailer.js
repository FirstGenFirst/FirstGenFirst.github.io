/**
 * This script should not be used directly. It is used on Google Cloud to handle
 * incoming Contact Us form requests, and is only included in the GitHub repos-
 * itory for version control. The necessary credentials for sending emails have
 * been redacted and replaced with comments, and consequently, make this file
 * syntically invalid.
 */

const nodemailer = require("nodemailer");

exports.email = (req, res) => {
  const USERNAME = /* Gmail Address */;
  const PASSWORD = /* Gmail Password */;

  res.set("Access-Control-Allow-Origin", "*");

  const SUCCESSFUL_FORM = {
    en: "https://firstgenfirst.org/formsubmitted",
    es: "https://firstgenfirst.org/formularioenviado"
  };
  const ERRORED_FORM = {
    en: "https://firstgenfirst.org/formerror",
    es: "https://firstgenfirst.org/formularioerror"
  };

  function redirect(url, metadata, lang) {
    const loc = `${url}?metadata=${encodeURIComponent(JSON.stringify(metadata || {}))}`;
    switch (lang) {
      case "en":
      default:
        return `
          <!DOCTYPE html>
          <html lang="en">
            <meta charset="utf-8">
            <title>Redirecting&hellip;</title>
            <script>location.replace("${loc}")</script>
            <meta http-equiv="refresh" content="0; url=${url}">
            <meta name="robots" content="noindex">
            <h1>Redirecting&hellip;</h1>
            <a href="${loc}">Click here if you are not redirected.</a>
          </html>`;
      case "es":
        return `
          <!DOCTYPE html>
          <html lang="es">
            <meta charset="utf-8">
            <title>Redireccionando&hellip;</title>
            <script>location.replace("${loc}")</script>
            <meta http-equiv="refresh" content="0; url=${url}">
            <meta name="robots" content="noindex">
            <h1>Redireccionando&hellip;</h1>
            <a href="${loc}">Haga clic aquí si no se le redirige.</a>
          </html>`;
    }
  }

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
      res.status(status).send(redirect(ERRORED_FORM[lang], METADATA, lang));
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
      res.status(status).send(redirect(SUCCESSFUL_FORM[lang], METADATA, lang));
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
      from: "info@firstgenfirst.org",
      to: "info@firstgenfirst.org",
      subject: "New \"Contact Us\" Entry",
      text: `Name: ${name}\nEmail: ${email}\nMessage: ${message}\n\nLang: ${lang || "unset"}\nSubmitted from: ${typeof path == "string" ? "https://firstgenfirst.org" + path : req.get("Referer")}`
    };

    transporter.sendMail(mailOptions, function(err, info) {
      if (err)
        fail(500, "Error sending email", err, lang);
      else
        succeed(200, "OK", info, lang);
    });
  }
};
