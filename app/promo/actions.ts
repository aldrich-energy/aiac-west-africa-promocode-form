"use server"

import nodemailer from 'nodemailer'

interface FormState {
  message: string
  errors: Record<string, string>
}

// Get promocode from Firestore without pagination limits
async function getPromocode(code: string): Promise<{ id: string; isUsed: boolean } | null> {
  const projectId = process.env.FIREBASE_PROJECT_ID
  const url = `https://firestore.googleapis.com/v1/projects/${projectId}/databases/(default)/documents:runQuery`

  const body = {
    structuredQuery: {
      from: [{ collectionId: "promocodes" }],
      where: {
        fieldFilter: {
          field: { fieldPath: "code" },
          op: "EQUAL",
          value: /^\d+$/.test(code)
            ? { integerValue: code }
            : { stringValue: code }
        }
      },
      limit: 1
    }
  }

  try {
    const response = await fetch(url, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body)
    })

    const data = await response.json()

    if (data && data[0] && data[0].document) {
      const doc = data[0].document
      const fields = doc.fields || {}
      return {
        id: doc.name.split("/").pop() || "",
        isUsed: fields.isUsed?.booleanValue || false
      }
    }

    return null
  } catch (error) {
    console.error("Promocode fetch error:", error)
    return null
  }
}

// Update promocode to mark as used (updated to use isUsed, usedBy, usedAt fields)
async function updatePromocodeAsUsed(docId: string, companyName: string): Promise<boolean> {
  const projectId = process.env.FIREBASE_PROJECT_ID
  const url = `https://firestore.googleapis.com/v1/projects/${projectId}/databases/(default)/documents/promocodes/${docId}?updateMask.fieldPaths=isUsed&updateMask.fieldPaths=usedBy&updateMask.fieldPaths=usedAt`

  // Create formatted datetime like: "August 6, 2025 at 10:24:25 AM UTC+4"
  const timezone = 'Asia/Dubai' // UTC+4
  const now = new Date()
  const formatter = new Intl.DateTimeFormat('en-US', {
    timeZone: timezone,
    year: 'numeric',
    month: 'long',
    day: 'numeric',
    hour: 'numeric',
    minute: '2-digit',
    second: '2-digit',
    hour12: true,
  })
  const formattedDate = formatter.format(now) + ' UTC+4'

  try {
    const response = await fetch(url, {
      method: "PATCH",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        fields: {
          isUsed: { booleanValue: true },
          usedBy: { stringValue: companyName },
          usedAt: { stringValue: formattedDate },
        },
      }),
    })

    return response.ok
  } catch (error) {
    console.error("Promocode update error:", error)
    return false
  }
}

export async function submitRegistration(prevState: FormState, formData: FormData): Promise<FormState> {
  try {
    // Extract form data
    const prefix = formData.get("prefix") as string
    const firstName = formData.get("firstName") as string
    const lastName = formData.get("lastName") as string
    const companyName = formData.get("companyName") as string
    const jobTitle = formData.get("jobTitle") as string
    const emailInput = formData.get("email") as string
    const email = emailInput.toLowerCase().trim()
    const mobile = formData.get("mobile") as string
    const country = formData.get("country") as string
    const promocode = formData.get("promocode") as string
    const mainObjective = formData.get("mainObjective") as string
    const hearAboutUs = formData.get("hearAboutUs") as string
    const consent = formData.get("consent") as string
    const captchaToken = formData.get("captchaToken") as string

    // Validation
    const errors: Record<string, string> = {}

    if (!firstName) errors.firstName = "First name is required"
    if (!lastName) errors.lastName = "Last name is required"
    if (!companyName) errors.companyName = "Company name is required"
    if (!jobTitle) errors.jobTitle = "Job title is required"
    if (!email) errors.email = "Email is required"
    if (!mobile) errors.mobile = "Phone number is required"
    if (!mainObjective) errors.mainObjective = "Main objective is required"
    if (!consent) errors.consent = "You must agree to the privacy policy"
    if (!captchaToken) errors.captcha = "Please complete the captcha"
    if (!promocode) errors.promocode = "Promocode is required"

    if (Object.keys(errors).length > 0) {
      return { message: "Please fix the errors below", errors }
    }

    // Case: Promocode provided - Validate via Firebase
    const promoData = await getPromocode(promocode)

    if (!promoData) {
      return {
        message: "Invalid promocode",
        errors: { promocode: "Promocode is invalid. Please check and try again." },
      }
    }

    // Check if already used
    if (promoData.isUsed === true) {
      return {
        message: "Promocode already used",
        errors: { promocode: "This promocode has already been used." },
      }
    }

    // Update promocode to mark as used in Firebase
    await updatePromocodeAsUsed(promoData.id, companyName)

    // Nodemailer Setup for one.com
    const transporter = nodemailer.createTransport({
      host: "send.one.com",
      port: 465,
      secure: true, // true for 465, false for other ports
      auth: {
        user: process.env.EMAIL,
        pass: process.env.PASSWORD,
      },
    })

    // Construct Email HTML Template
    const htmlTemplate = `
      <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; color: #333;">
        <h2 style="color: #22c55e; border-bottom: 2px solid #22c55e; padding-bottom: 10px;">New Promocode Registration</h2>
        <p>A new user has submitted the promocode registration form. Here are the details:</p>
        <table style="width: 100%; border-collapse: collapse; margin-top: 20px;">
          <tr>
            <td style="padding: 10px; border: 1px solid #ddd; font-weight: bold; width: 35%;">Prefix</td>
            <td style="padding: 10px; border: 1px solid #ddd;">${prefix || "N/A"}</td>
          </tr>
          <tr>
            <td style="padding: 10px; border: 1px solid #ddd; font-weight: bold;">First Name</td>
            <td style="padding: 10px; border: 1px solid #ddd;">${firstName}</td>
          </tr>
          <tr>
            <td style="padding: 10px; border: 1px solid #ddd; font-weight: bold;">Last Name</td>
            <td style="padding: 10px; border: 1px solid #ddd;">${lastName}</td>
          </tr>
          <tr>
            <td style="padding: 10px; border: 1px solid #ddd; font-weight: bold;">Company Name</td>
            <td style="padding: 10px; border: 1px solid #ddd;">${companyName}</td>
          </tr>
          <tr>
            <td style="padding: 10px; border: 1px solid #ddd; font-weight: bold;">Job Title</td>
            <td style="padding: 10px; border: 1px solid #ddd;">${jobTitle}</td>
          </tr>
          <tr>
            <td style="padding: 10px; border: 1px solid #ddd; font-weight: bold;">Email Address</td>
            <td style="padding: 10px; border: 1px solid #ddd;">${email}</td>
          </tr>
          <tr>
            <td style="padding: 10px; border: 1px solid #ddd; font-weight: bold;">Mobile</td>
            <td style="padding: 10px; border: 1px solid #ddd;">${mobile}</td>
          </tr>
          <tr>
            <td style="padding: 10px; border: 1px solid #ddd; font-weight: bold;">Country</td>
            <td style="padding: 10px; border: 1px solid #ddd;">${country || "N/A"}</td>
          </tr>
          <tr>
            <td style="padding: 10px; border: 1px solid #ddd; font-weight: bold;">Main Objective</td>
            <td style="padding: 10px; border: 1px solid #ddd;">${mainObjective}</td>
          </tr>
          <tr>
            <td style="padding: 10px; border: 1px solid #ddd; font-weight: bold;">Promocode Used</td>
            <td style="padding: 10px; border: 1px solid #ddd;">${promocode}</td>
          </tr>
        </table>
        <br>
        <p style="font-size: 12px; color: #777;">Submission secured by hCaptcha. Promocode validated and marked as used.</p>
      </div>
    `

    // Send email to register@aiacafrica.com
    await transporter.sendMail({
      from: `"AIAC Registration" <${process.env.EMAIL}>`,
      to: "register@aiacafrica.com",
      subject: `New Promocode Registration: ${firstName} ${lastName} - ${companyName}`,
      html: htmlTemplate,
    })

    // Send auto-reply to the user
    const userHtmlTemplate = `
      <div style="background-color: #0A343D; padding: 40px 20px; font-family: Arial, sans-serif; min-height: 100%;">
        <div style="max-width: 600px; margin: 0 auto; background-color: #0A343D; border: 1px solid #145c6b; border-radius: 8px; overflow: hidden; color: #ffffff;">
          <div style="text-align: center; border-bottom: 3px solid #22c55e;">
            <img src="https://firebasestorage.googleapis.com/v0/b/aiacwestafrica-e2073.firebasestorage.app/o/email_template_components%2FEmail%20Signature-04.jpg?alt=media&token=8270f300-9fce-4a9d-bd69-7fa1715656d6" alt="AIAC WEST AFRICA" style="width: 100%; max-width: 600px; height: auto; display: block; border: none;" />
          </div>
          <div style="padding: 30px;">
            <h2 style="color: #22c55e; margin-top: 0;">Registration Successful!</h2>
            <p style="color: #e2e8f0; font-size: 16px; line-height: 1.6;">Dear ${firstName},</p>
            <p style="color: #e2e8f0; font-size: 16px; line-height: 1.6;">Thank you for your submission! Your registration has been successfully received.</p>
            <p style="color: #e2e8f0; font-size: 16px; line-height: 1.6;">Our team is reviewing your details and will contact you shortly with more information.</p>
            <br>
            <p style="color: #cbd5e1; font-size: 14px; margin-bottom: 0;">Best regards,<br><strong style="color: #22c55e; font-size: 16px;">The AIAC WEST AFRICA Team</strong></p>
          </div>
        </div>
      </div>
    `

    await transporter.sendMail({
      from: `"AIAC WEST AFRICA" <${process.env.EMAIL}>`,
      to: email,
      subject: "Registration Successful - AIAC WEST AFRICA",
      html: userHtmlTemplate,
    })

    return { message: "Registration successful!", errors: {} }
  } catch (error) {
    console.error("Promo Registration error:", error)
    return { message: "Registration failed. Please try again.", errors: {} }
  }
}
