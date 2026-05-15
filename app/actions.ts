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
  data: Record<string, { stringValue?: string; timestampValue?: string; booleanValue?: boolean; integerValue?: number; nullValue?: null }>
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

    if (!response.ok) {
      const errorText = await response.text()
      console.error(`[Firestore Error] Failed to save to ${collection}: Status ${response.status}`, errorText)
      return false
    }

    console.log(`[Firestore Success] Saved to collection: ${collection}`)
    return true
  } catch (error) {
    console.error(`[Firestore Exception] Error saving to ${collection}:`, error)
    return false
  }
}

// Get user from Firestore by email
async function getUserByEmail(email: string): Promise<string | null> {
  const projectId = process.env.FIREBASE_PROJECT_ID
  const url = `https://firestore.googleapis.com/v1/projects/${projectId}/databases/(default)/documents:runQuery`
  const normalizedEmail = email.toLowerCase().trim()

  const body = {
    structuredQuery: {
      from: [{ collectionId: "Users" }],
      where: {
        fieldFilter: {
          field: { fieldPath: "email" },
          op: "EQUAL",
          value: { stringValue: normalizedEmail }
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
    console.log(`[getUserByEmail] Query result for ${normalizedEmail}:`, JSON.stringify(data))

    if (data && Array.isArray(data)) {
      // runQuery returns an array of objects, one of which might contain the document
      const foundEntry = data.find(item => item.document)
      if (foundEntry && foundEntry.document) {
        const docId = foundEntry.document.name.split("/").pop() || null
        console.log(`[getUserByEmail] Found existing user ID: ${docId}`)
        return docId
      }
    }

    console.log(`[getUserByEmail] No existing user found for ${normalizedEmail}`)
    return null
  } catch (error) {
    console.error(`[getUserByEmail] Exception checking email ${normalizedEmail}:`, error)
    return null
  }
}    

// Update data in Firestore using REST API
async function updateFirestoreDocument(
  collection: string,
  docId: string,
  data: Record<string, any>
): Promise<boolean> {
  const projectId = process.env.FIREBASE_PROJECT_ID
  const url = `https://firestore.googleapis.com/v1/projects/${projectId}/databases/(default)/documents/${collection}/${docId}`

  // Building the updateMask to ensure we update exactly the passed fields
  const updateMaskStrings = Object.keys(data).map(key => `updateMask.fieldPaths=${key}`).join('&')
  const completeUrl = `${url}?${updateMaskStrings}`

  try {
    const response = await fetch(completeUrl, {
      method: "PATCH",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        fields: data,
      }),
    })

    if (!response.ok) {
      const errorText = await response.text()
      console.error(`[Firestore Error] Failed to update ${collection}/${docId}: Status ${response.status}`, errorText)
      return false
    }

    console.log(`[Firestore Success] Updated document in collection: ${collection}`)
    return true
  } catch (error) {
    console.error(`[Firestore Exception] Error updating ${collection}/${docId}:`, error)
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

    // Prepare user data
    const username = `${firstName} ${lastName}`.trim()
    const password = `${email.split("@")[0]}@${Math.floor(Math.random() * 9000) + 1000}`
    
    // Generate a unique userId (20 chars like in screenshot)
    const characters = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789'
    let generatedUserId = ''
    for (let i = 0; i < 20; i++) {
      generatedUserId += characters.charAt(Math.floor(Math.random() * characters.length))
    }

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
      userType: { integerValue: 4 },
      country: { stringValue: country || "" },
      mainObjective: { stringValue: mainObjective },
      hearAboutUs: { stringValue: hearAboutUs || "" },
      eventYear: { stringValue: "2026" },
      timestamp: { timestampValue: new Date().toISOString() },
    }

    console.log("Checking if user exists in Users collection by email...")
    const existingUserId = await getUserByEmail(email)

    if (existingUserId) {
      console.log(`Existing user found with email ${email}, updating...`)
      const usersUpdateResult = await updateFirestoreDocument("Users", existingUserId, delegateUserData)
      console.log("Users update result:", usersUpdateResult)
    } else {
      console.log("No existing user found. Attempting to save new user to Users collection...")
      const usersSaveResult = await sendToFirestore("Users", delegateUserData)
      console.log("Users save result:", usersSaveResult)
    }

    // Store data in 'delegates' collection as requested
    console.log("Attempting to save to delegates collection...")
    const delegateData = {
      bio: { stringValue: "" },
      companyImage: { stringValue: "" },
      createdAt: { stringValue: formattedDate },
      dateCreated: { stringValue: formattedDate },
      designation: { stringValue: jobTitle },
      company: { stringValue: companyName },
      email: { stringValue: email },
      eventYear: { stringValue: "2026" },
      exhibitorId: { stringValue: "" },
      imageUrl: { stringValue: "" },
      linkedin: { stringValue: "" },
      mobile: { stringValue: mobile },
      name: { stringValue: username.toUpperCase() },
      registrationType: { stringValue: "Delegate" },
      userId: { stringValue: generatedUserId },
    }

    const delegatesSaveResult = await sendToFirestore("delegates", delegateData)
    console.log("Delegates save result:", delegatesSaveResult)

    // Send delegate email (template ID 13)
    await sendBrevoEmail(
      {
        email,
        password,
        name: username,
        usertype: "Delegate",
        companyname: companyName,
        mobile: mobile,
        designation: jobTitle,
      },
      19,
    )

    return { message: "Registration successful!", errors: {} }
  } catch (error) {
    console.error("Registration error:", error)
    return { message: "Registration failed. Please try again.", errors: {} }
  }
}