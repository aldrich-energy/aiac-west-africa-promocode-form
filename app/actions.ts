"use server"

// import { MongoClient } from 'mongodb'

interface FormState {
  message: string
  errors: Record<string, string>
}

// MongoDB connection function — disabled, not needed currently
// async function connectToMongoDB() {
//   const uri = process.env.MONGODB_URI
//   if (!uri) {
//     throw new Error('MONGODB_URI environment variable is not set')
//   }
//   const client = new MongoClient(uri)
//   try {
//     await client.connect()
//     return client
//   } catch (error) {
//     console.error('MongoDB connection error:', error)
//     throw error
//   }
// }

// Send data to MongoDB — disabled, not needed currently
// async function sendToMongoDB(collection: string, data: Record<string, unknown>): Promise<boolean> {
//   let client: MongoClient | null = null
//   try {
//     client = await connectToMongoDB()
//     const database = client.db()
//     const dbCollection = database.collection(collection)
//     await dbCollection.insertOne(data)
//     return true
//   } catch (error) {
//     console.error('MongoDB error:', error)
//     return false
//   } finally {
//     if (client) {
//       await client.close()
//     }
//   }
// }

// XOR encryption function (matching your PHP code)
function xorEncrypt(text: string, key: string): string {
  const textBytes = text.split("")
  const keyBytes = key.split("")
  const encryptedBytes: string[] = []

  textBytes.forEach((char, i) => {
    const encryptedChar = String.fromCharCode(char.charCodeAt(0) ^ keyBytes[i % keyBytes.length].charCodeAt(0))
    encryptedBytes.push(encryptedChar)
  })

  return Buffer.from(encryptedBytes.join(""), "binary").toString("base64")
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
          // Try both integer and string match depending on stored type
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

// Send data to Firestore using REST API
async function sendToFirestore(
  collection: string,
  data: Record<string, { stringValue?: string; timestampValue?: string; booleanValue?: boolean; integerValue?: number }>
): Promise<boolean> {
  const projectId = process.env.FIREBASE_PROJECT_ID
  const url = `https://firestore.googleapis.com/v1/projects/${projectId}/databases/(default)/documents/${collection}`

  try {
    const response = await fetch(url, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        fields: data,
      }),
    })

    return response.ok
  } catch (error) {
    console.error("Firestore error:", error)
    return false
  }
}

// Send email via Brevo API
async function sendBrevoEmail(data: Record<string, string>, templateId: number): Promise<boolean> {
  const plaintext = `${data.email},${data.name},${data.designation},${data.companyname},${data.mobile},${data.usertype},AIMCS AFRICA`
  const encrypted = xorEncrypt(plaintext, "aldrichinternational")

  const emailData = {
    to: [{ email: data.email, name: data.name }],
    templateId: templateId,
    params: {
      username: data.name,
      usertype: data.usertype,
      companyname: data.companyname,
      designation: data.designation,
      qrCodeURL: `https://api.qrserver.com/v1/create-qr-code/?size=150x150&data=${encodeURIComponent(encrypted)}`,
      email: data.email,
      password: data.password,
    },
  }

  try {
    const response = await fetch("https://api.brevo.com/v3/smtp/email", {
      method: "POST",
      headers: {
        Accept: "application/json",
        "api-key": process.env.BREVO_API_KEY || "",
        "Content-Type": "application/json",
      },
      body: JSON.stringify(emailData),
    })

    return response.ok
  } catch (error) {
    console.error("Email sending failed:", error)
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
    const email = formData.get("email") as string
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

    // Prepare user data
    const username = `${firstName} ${lastName}`.trim()
    const password = `${email.split("@")[0]}@${Math.floor(Math.random() * 9000) + 1000}`

    // Create formatted datetime for delegates collection
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

    // Case: Promocode provided - Validate
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

    // Update promocode to mark as used
    await updatePromocodeAsUsed(promoData.id, companyName)

    // Store delegate user in Firestore Users collection
    const delegateUserData = {
      username: { stringValue: username },
      companyname: { stringValue: companyName },
      designation: { stringValue: jobTitle },
      email: { stringValue: email },
      mobile: { stringValue: mobile },
      password: { stringValue: password },
      linkedin: { stringValue: "" },
      profileImage: { stringValue: "" },
      userType: { integerValue: 16 },
      country: { stringValue: country || "" },
      mainObjective: { stringValue: mainObjective },
      hearAboutUs: { stringValue: hearAboutUs },
      promocode: { stringValue: promocode },
      eventYear: { stringValue: "2026" },
      timestamp: { timestampValue: new Date().toISOString() },
    }

    await sendToFirestore("Users", delegateUserData)

    // Store delegate info in Firestore delegates collection
    const delegateData = {
      bio: { stringValue: "" },
      companyImage: { stringValue: "" },
      createdAt: { stringValue: formattedDate },
      designation: { stringValue: jobTitle },
      company: { stringValue: companyName },
      email: { stringValue: email },
      exhibitorId: { stringValue: "" },
      imageUrl: { stringValue: "" },
      linkedin: { stringValue: "" },
      mobile: { stringValue: mobile },
      name: { stringValue: username },
      userType: { stringValue: "VIP Visitor" },
      userId: { stringValue: "" },
      promocode: { stringValue: promocode },
    }

    await sendToFirestore("other_members", delegateData)

    // Send data to MongoDB delegates collection — disabled, not needed currently
    // const mongoDelegateDataWithPromo = {
    //   createdAt: formattedDate,
    //   designation: jobTitle,
    //   email: email,
    //   mobile: mobile,
    //   name: username,
    //   registrationType: "VIP Visitor",
    //   prefix: prefix,
    //   firstName: firstName,
    //   lastName: lastName,
    //   companyName: companyName,
    //   country: country || "",
    //   mainObjective: mainObjective,
    //   hearAboutUs: hearAboutUs,
    //   promocode: promocode,
    //   createdAtMongo: new Date(),
    // }
    // await sendToMongoDB("VIPVisitors", mongoDelegateDataWithPromo)

    // Send delegate email (template ID 12)
    await sendBrevoEmail(
      {
        email,
        password,
        name: username,
        usertype: "VIP Visitor",
        companyname: companyName,
        mobile:mobile,
        designation: jobTitle,
      },
      13,
    )

    return { message: "Registration successful!", errors: {} }
  } catch (error) {
    console.error("Registration error:", error)
    return { message: "Registration failed. Please try again.", errors: {} }
  }
}