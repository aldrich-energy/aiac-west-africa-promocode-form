"use client";

import { useState, useRef } from "react";
import { PhoneInput, CountrySelector } from "react-international-phone";
import { submitRegistration } from "./actions";
import "react-international-phone/style.css";
import HCaptcha from "@hcaptcha/react-hcaptcha";
import { PhoneNumberUtil } from "google-libphonenumber";
// import HeaderImg from "@/public/images/banner.png";
// import Image from "next/image";

interface FormState {
  message: string;
  errors: Record<string, string>;
}

interface FormErrors {
  [key: string]: string;
}

const phoneUtil = PhoneNumberUtil.getInstance();

const isPhoneValid = (phone: string) => {
  try {
    return phoneUtil.isValidNumber(phoneUtil.parseAndKeepRawInput(phone));
  } catch {
    return false;
  }
};

export default function RegistrationForm() {
  const [state, setState] = useState<FormState>({ message: "", errors: {} });
  const [isSubmitting, setIsSubmitting] = useState<boolean>(false);
  const [country, setCountry] = useState<string>("ae");
  const [countryName, setCountryName] = useState<string>(
    "United Arab Emirates",
  );
  const [mobile, setMobile] = useState<string>("");
  const [errors, setErrors] = useState<FormErrors>({});
  const [submitted, setSubmitted] = useState(false);
  const formRef = useRef<HTMLFormElement>(null);
  const [hcaptchaToken, setHcaptchaToken] = useState<string>("");
  const hcaptchaRef = useRef<HCaptcha | null>(null);
  const [formMessage, setFormMessage] = useState<string>("");
  const [formMessageType, setFormMessageType] = useState<
    "" | "success" | "error" | "loading"
  >("");

  // New state for success popup
  const [showSuccessPopup, setShowSuccessPopup] = useState(false);

  // Validation function
  const validateField = (name: string, value: string) => {
    if (
      [
        "firstName",
        "lastName",
        "companyName",
        "jobTitle",
        "email",
        "mainObjective",
        "hearAboutUs",
      ].includes(name) &&
      !value
    ) {
      return "This field is required";
    }
    if (name === "mobile") {
      if (!value) {
        return "This field is required";
      }
      if (!isPhoneValid(value)) {
        return "Please enter a valid phone number";
      }
    }
    if (name === "consent" && !formRef.current?.consent?.checked) {
      return "You must agree to the privacy policy";
    }
    if (name === "promocode") {
      if (!value) {
        return "Promocode is required";
      }
      if (value.trim().length < 3) {
        return "Please enter a valid promocode";
      }
    }
    return "";
  };

  const handleSubmit = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setSubmitted(true);
    setFormMessage("");
    setFormMessageType("");
    const newErrors: FormErrors = {};
    const form = event.currentTarget;
    const requiredFields = [
      { name: "firstName", value: form.firstName?.value },
      { name: "lastName", value: form.lastName?.value },
      { name: "companyName", value: form.companyName?.value },
      { name: "jobTitle", value: form.jobTitle?.value },
      { name: "email", value: form.email?.value },
      { name: "mobile", value: mobile },
      { name: "mainObjective", value: form.mainObjective?.value },
      { name: "hearAboutUs", value: form.hearAboutUs?.value },
      { name: "promocode", value: form.promocode?.value },
      { name: "consent", value: form.consent?.checked ? "on" : "" },
    ];
    requiredFields.forEach(({ name, value }) => {
      const err = validateField(name, value);
      if (err) newErrors[name] = err;
    });
    setErrors(newErrors);
    if (Object.keys(newErrors).length > 0) {
      setFormMessage("Please fix the errors in the form.");
      setFormMessageType("error");
      return;
    }
    if (!hcaptchaToken) {
      setFormMessage("Please complete the captcha.");
      setFormMessageType("error");
      return;
    }
    setIsSubmitting(true);
    setFormMessage("Submitting registration...");
    setFormMessageType("loading");
    const formData = new FormData(form);
    formData.append("mobile", mobile);
    formData.append("country", countryName);
    formData.append("promocode", form.promocode?.value || "");
    formData.append("captchaToken", hcaptchaToken);

    const result = await submitRegistration(state, formData);
    setState(result);
    setIsSubmitting(false);
    if (result.message.includes("success")) {
      // Show success popup instead of form message
      setShowSuccessPopup(true);
      if (formRef.current) {
        formRef.current.reset();
      }
      setMobile("");
      setHcaptchaToken("");
      setErrors({});
      setFormMessage("");
      setFormMessageType("");
    } else {
      setFormMessage(result.message);
      setFormMessageType("error");
      // if (result.errors?.promocode) {
      //   setErrors((prev) => ({ ...prev, promocode: result.errors.promocode }));
      //   setTouched((prev) => ({ ...prev, promocode: true }));
      // }
    }
  };

  const closeSuccessPopup = () => {
    setShowSuccessPopup(false);
  };

  return (
    <div className="min-h-screen bg-transparent py-6 px-4 sm:px-6 lg:px-8">
      <div className="max-w-7xl mx-auto">
        <div className="flex justify-center items-center min-h-[calc(100vh-4rem)]">
          <div className="w-full max-w-3xl">
            <div className="space-y-4">
              <div
                className="bg-slate-900/70 border border-white/10 shadow-2xl rounded-[32px] flex flex-col justify-center h-full backdrop-blur-xl"
              >
                <div className="p-8">
                  <form
                    ref={formRef}
                    onSubmit={handleSubmit}
                    className="space-y-4 registration-form"
                  >
                    {/* Form Message Box */}
                    {formMessage && (
                      <div
                        className={`mb-4 p-3 rounded border text-sm ${
                          formMessageType === "success"
                            ? "bg-green-50 border-green-400 text-green-700"
                            : formMessageType === "error"
                              ? "bg-red-50 border-red-400 text-red-700"
                              : formMessageType === "loading"
                                ? "bg-blue-50 border-blue-400 text-blue-700"
                                : "bg-white border-gray-300 text-white"
                        }`}
                        style={{ fontWeight: 500 }}
                      >
                        {formMessage}
                      </div>
                    )}

                    {/* Prefix and First Name Row */}
                    <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                      <div className="space-y-1">
                        <label
                          htmlFor="prefix"
                          className="block text-white mb-1 font-medium"
                        >
                          Prefix
                        </label>
                        <select
                          name="prefix"
                          defaultValue="Mr."
                          className="w-full bg-transparent border-0 border-b-2 border-slate-600 rounded-[12px] focus:border-[#22c55e] shadow-none focus:outline-none focus:ring-0 py-2 text-slate-100"
                        >
                          <option value="Mr.">Mr.</option>
                          <option value="Mrs.">Mrs.</option>
                          <option value="Ms.">Ms.</option>
                          <option value="Dr.">Dr.</option>
                          <option value="Prof.">Prof.</option>
                        </select>
                      </div>

                      <div className="md:col-span-2 space-y-1">
                        <label
                          htmlFor="firstName"
                          className="block text-white mb-1 font-medium"
                        >
                          First Name <span className="text-red-500">*</span>
                        </label>
                        <input
                          id="firstName"
                          name="firstName"
                          type="text"
                          placeholder="First Name *"
                          className="w-full bg-transparent border-0 border-b-2 border-slate-600 rounded-[12px] focus:border-[#22c55e] px-0 shadow-none focus:outline-none focus:ring-0 py-2 text-slate-100 placeholder:text-slate-500"
                        />
                        {submitted && errors.firstName && (
                          <p className="text-red-500 text-xs pt-1">
                            {errors.firstName}
                          </p>
                        )}
                      </div>
                    </div>

                    {/* Last Name and Company Name Row */}
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                      <div className="space-y-1">
                        <label
                          htmlFor="lastName"
                          className="block text-white mb-1 font-medium"
                        >
                          Last Name <span className="text-red-500">*</span>
                        </label>
                        <input
                          id="lastName"
                          name="lastName"
                          type="text"
                          placeholder="Last Name *"
                          className="w-full bg-transparent border-0 border-b-2 border-slate-600 rounded-[12px] focus:border-[#22c55e] px-0 shadow-none focus:outline-none focus:ring-0 py-2 text-slate-100 placeholder:text-slate-500"
                        />
                        {submitted && errors.lastName && (
                          <p className="text-red-500 text-xs pt-1">
                            {errors.lastName}
                          </p>
                        )}
                      </div>
                      <div className="space-y-1">
                        <label
                          htmlFor="companyName"
                          className="block text-white mb-1 font-medium"
                        >
                          Company Name <span className="text-red-500">*</span>
                        </label>
                        <input
                          id="companyName"
                          name="companyName"
                          type="text"
                          placeholder="Company Name *"
                          className="w-full bg-transparent border-0 border-b-2 border-slate-600 rounded-[12px] focus:border-[#22c55e] px-0 shadow-none focus:outline-none focus:ring-0 py-2 text-slate-100 placeholder:text-slate-500"
                        />
                        {submitted && errors.companyName && (
                          <p className="text-red-500 text-xs pt-1">
                            {errors.companyName}
                          </p>
                        )}
                      </div>
                    </div>

                    {/* Job Title and Email Row */}
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                      <div className="space-y-1">
                        <label
                          htmlFor="jobTitle"
                          className="block text-white mb-1 font-medium"
                        >
                          Job Title <span className="text-red-500">*</span>
                        </label>
                        <input
                          id="jobTitle"
                          name="jobTitle"
                          type="text"
                          placeholder="Job Title *"
                          className="w-full bg-transparent border-0 border-b-2 border-slate-600 rounded-[12px] focus:border-[#22c55e] px-0 shadow-none focus:outline-none focus:ring-0 py-2 text-slate-100 placeholder:text-slate-500"
                        />
                        {submitted && errors.jobTitle && (
                          <p className="text-red-500 text-xs pt-1">
                            {errors.jobTitle}
                          </p>
                        )}
                      </div>
                      <div className="space-y-1">
                        <label
                          htmlFor="email"
                          className="block text-white mb-1 font-medium"
                        >
                          Email Address <span className="text-red-500">*</span>
                        </label>
                        <input
                          id="email"
                          name="email"
                          type="email"
                          placeholder="Email Address *"
                          className="w-full bg-transparent border-0 border-b-2 border-slate-600 rounded-[12px] focus:border-[#22c55e] px-0 shadow-none focus:outline-none focus:ring-0 py-2 text-slate-100 placeholder:text-slate-500"
                        />
                        {submitted && errors.email && (
                          <p className="text-red-500 text-xs pt-1">
                            {errors.email}
                          </p>
                        )}
                      </div>
                    </div>

                    {/* Phone and Country Row */}
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                      <div className="space-y-1">
                        <label className="block text-white mb-1 font-medium">
                          Phone Number <span className="text-red-500">*</span>
                        </label>
                        <PhoneInput
                          defaultCountry={country}
                          value={mobile}
                          onChange={setMobile}
                          className={`w-full${
                            errors.mobile ? " input-field-error" : ""
                          }`}
                          inputClassName="bg-slate-950/30 border-0 border-b-2 border-slate-600 rounded-[12px] focus:border-[#22c55e] px-0 shadow-none focus:outline-none focus:ring-0 py-2 text-slate-100 placeholder:text-slate-500"
                          placeholder="Phone Number *"
                          countrySelectorStyleProps={{
                            buttonClassName:
                              "bg-transparent border-0 shadow-none focus:outline-none",
                          }}
                        />
                        {submitted && errors.mobile && (
                          <p className="text-red-500 text-xs pt-1">
                            {errors.mobile}
                          </p>
                        )}
                      </div>
                      <div className="space-y-1">
                        <label className="block text-white mb-1 font-medium">
                          Country
                        </label>
                        <div className="w-full border-slate-600 rounded-[12px] focus-within:border-[#22c55e] px-0 shadow-none focus-within:outline-none focus-within:ring-0 py-2 flex items-center">
                          <CountrySelector
                            selectedCountry={country}
                            onSelect={({
                              iso2,
                              name,
                            }: {
                              iso2: string;
                              name: string;
                            }) => {
                              setCountry(iso2);
                              setCountryName(name);
                            }}
                            buttonClassName="bg-transparent border-0 shadow-none focus:outline-none text-slate-100"
                          />
                          <input
                            id="country"
                            type="text"
                            value={countryName}
                            readOnly
                            placeholder="Select country"
                            className="flex-1 bg-transparent border-0 outline-none text-slate-100 placeholder:text-slate-500 px-0"
                          />
                        </div>
                        {submitted && errors.country && (
                          <p className="text-red-500 text-xs pt-1">
                            {errors.country}
                          </p>
                        )}
                      </div>
                    </div>

                    {/* Main Objective Dropdown */}
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                      <div className="space-y-1">
                        <label
                          htmlFor="mainObjective"
                          className="block text-white mb-1 font-medium"
                        >
                          Main Objective for registering at AIMCS AFRICA{" "}
                          <span className="text-red-500">*</span>
                        </label>
                        <select
                          id="mainObjective"
                          name="mainObjective"
                          className="w-full bg-transparent border-0 border-b-2 border-slate-600 rounded-[12px] focus:border-[#22c55e] shadow-none focus:outline-none cursor-pointer focus:ring-0 py-2 text-slate-100"
                          defaultValue=""
                        >
                          <option value="" disabled>
                            Select your main objective
                          </option>
                          <option value="Asset Integrity">
                            Asset Integrity
                          </option>
                          <option value="Process Safety">Process Safety</option>
                          <option value="Digital Transformation">
                            Digital Transformation
                          </option>
                        </select>
                        {submitted && errors.mainObjective && (
                          <p className="text-red-500 text-xs pt-1">
                            {errors.mainObjective}
                          </p>
                        )}
                      </div>

                      {/* How did you hear about us Dropdown */}
                      <div className="space-y-1">
                        <label
                          htmlFor="hearAboutUs"
                          className="block text-white mb-1 font-medium"
                        >
                          How did you hear about us?{" "}
                          <span className="text-red-500">*</span>
                        </label>
                        <select
                          id="hearAboutUs"
                          name="hearAboutUs"
                          className="w-full bg-transparent border-0 border-b-2 border-slate-600 rounded-[12px] focus:border-[#22c55e] shadow-none focus:outline-none cursor-pointer focus:ring-0 py-2 text-slate-100"
                          defaultValue=""
                        >
                          <option value="" disabled>
                            Select how you heard about us
                          </option>
                          <option value="Google Ads">Google Ads</option>
                          <option value="Industry Colleague/Word of Mouth">
                            Industry Colleague/Word of Mouth
                          </option>
                          <option value="Industry Magazine/Publication">
                            Industry Magazine/Publication
                          </option>
                          <option value="Newsletter">Newsletter</option>
                          <option value="Previous Event Attendance">
                            Previous Event Attendance
                          </option>
                          <option value="Search Engine (Google, Bing, etc.)">
                            Search Engine (Google, Bing, etc.)
                          </option>
                          <option value="Social Media">Social Media</option>
                          <option value="Other">Other</option>
                          {/* <option value="Social Media">Social Media</option>
                          <option value="Website">Website</option>
                          <option value="Newsletter">Newsletter</option>
                          <option value="Press & Media Partner">
                            Press & Media Partner
                          </option>
                          <option value="Friend Refers">Friend Refers</option>
                          <option value="Direct Sales">Direct Sales</option>
                          <option value="Direct Sales">Others</option> */}
                        </select>
                        {submitted && errors.hearAboutUs && (
                          <p className="text-red-500 text-xs pt-1">
                            {errors.hearAboutUs}
                          </p>
                        )}
                      </div>
                    </div>
                    {/* Promocode Field */}
                    <div className="space-y-1">
                      <label
                        htmlFor="promocode"
                        className="block text-slate-200 mb-1 font-medium"
                      >
                        Promocode <span className="text-amber-400">*</span>
                      </label>
                      <input
                        id="promocode"
                        name="promocode"
                        type="text"
                        className="w-full bg-slate-950/30 border-0 border-b-2 border-slate-600 rounded-[12px] focus:border-[#22c55e] px-0 shadow-none focus:outline-none focus:ring-0 py-2 text-slate-100 placeholder:text-slate-500"
                        placeholder="Enter promocode"
                        maxLength={16}
                      />
                      {submitted && errors.promocode && (
                        <p className="text-rose-400 text-xs pt-1">
                          {errors.promocode}
                        </p>
                      )}
                    </div>

                    {/* Consent Section */}
                    <div className="space-y-3">
                      <label className="block text-white mb-1 font-medium">
                        Consent <span className="text-red-500">*</span>
                      </label>
                      <div className="flex items-start space-x-2">
                        <input
                          type="checkbox"
                          id="consent"
                          name="consent"
                          className="w-5 h-5 cursor-pointer text-blue-600 bg-gray-100 border-gray-300 rounded mt-1"
                        />
                        <div className="text-sm text-white leading-relaxed">
                          <label htmlFor="consent">
                            By submitting this form, you agree to the processing
                            of your personal data by Aldrich as described in the{" "}
                            <a
                              href="https://aldrichme.com/en/privacy-policy.html"
                              className="text-blue-600 underline"
                            >
                              privacy policy
                            </a>
                          </label>
                          .
                        </div>
                      </div>
                      {submitted && errors.consent && (
                        <p className="text-red-500 text-xs pt-1">
                          {errors.consent}
                        </p>
                      )}
                    </div>

                    {/* hCaptcha Widget */}
                    <div className="flex items-center justify-start py-3">
                      <HCaptcha
                        sitekey={`${process.env.NEXT_PUBLIC_HCAPTCHA_SITE_KEY}`}
                        onVerify={setHcaptchaToken}
                        ref={hcaptchaRef}
                        theme="light"
                      />
                    </div>

                    {/* Submit Button */}
                    <div className="pt-3">
                      <button
                        type="submit"
                        className="w-full bg-[#22c55e] hover:bg-[#1f9a51] text-white py-3 text-lg font-semibold rounded-2xl transition-colors duration-200 shadow-lg shadow-emerald-500/20 cursor-pointer disabled:cursor-not-allowed disabled:opacity-60"
                        disabled={!hcaptchaToken || isSubmitting}
                      >
                        {isSubmitting ? (
                          <div className="flex items-center justify-center space-x-2">
                            <div className="w-5 h-5 border-2 border-white border-t-transparent rounded-full animate-spin"></div>
                            <span>Submitting...</span>
                          </div>
                        ) : (
                          "Submit"
                        )}
                      </button>
                    </div>
                  </form>
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* <div className="grid grid-cols-1 lg:grid-cols-2 items-stretch">
         
          <div className="h-full flex items-stretch">
            <div className="w-full h-full">
              <Image
                src={HeaderImg}
                alt="AICC Caspian Conference Header"
                className="w-full h-full object-cover rounded-l-lg rounded-tr-none rounded-br-none"
              />
            </div>
          </div>
         
        </div> */}
      </div>

      {/* Success Popup Modal */}
      {showSuccessPopup && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
          <div className="bg-gray-200 rounded-lg shadow-xl max-w-md w-full mx-4 transform transition-all">
            <div className="p-6">
              {/* Success Icon */}
              <div className="flex items-center justify-center w-16 h-16 mx-auto mb-4 bg-green-100 rounded-full">
                <svg
                  className="w-8 h-8 text-green-600"
                  fill="none"
                  stroke="currentColor"
                  viewBox="0 0 24 24"
                  xmlns="http://www.w3.org/2000/svg"
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth="2"
                    d="M5 13l4 4L19 7"
                  />
                </svg>
              </div>

              {/* Success Message */}
              <div className="text-center mb-6">
                <h3 className="text-xl font-semibold text-gray-900 mb-2">
                  Registration Successful!
                </h3>
                <p className="text-gray-600">
                  Thank you for registering. Your submission has been received
                  successfully.
                </p>
              </div>

              {/* LinkedIn Share Button */}
              <div className="space-y-3">
                {/* <button
                  onClick={handleLinkedInShare}
                  className="w-full bg-[#0077B5] cursor-pointer hover:bg-[#005885] text-white py-3 px-4 rounded-lg font-medium transition-colors flex items-center justify-center space-x-2"
                >
                  <svg
                    className="w-5 h-5"
                    fill="currentColor"
                    viewBox="0 0 24 24"
                    xmlns="http://www.w3.org/2000/svg"
                  >
                    <path d="M20.447 20.452h-3.554v-5.569c0-1.328-.027-3.037-1.852-3.037-1.853 0-2.136 1.445-2.136 2.939v5.667H9.351V9h3.414v1.561h.046c.477-.9 1.637-1.85 3.37-1.85 3.601 0 4.267 2.37 4.267 5.455v6.286zM5.337 7.433c-1.144 0-2.063-.926-2.063-2.065 0-1.138.92-2.063 2.063-2.063 1.14 0 2.064.925 2.064 2.063 0 1.139-.925 2.065-2.064 2.065zm1.782 13.019H3.555V9h3.564v11.452zM22.225 0H1.771C.792 0 0 .774 0 1.729v20.542C0 23.227.792 24 1.771 24h20.451C23.2 24 24 23.227 24 22.271V1.729C24 .774 23.2 0 22.222 0h.003z" />
                  </svg>
                  <span>Post on LinkedIn</span>
                </button> */}

                {/* Close Button */}
                <button
                  onClick={closeSuccessPopup}
                  className="w-full bg-gray-100 cursor-pointer hover:bg-gray-200 text-white py-3 px-4 rounded-lg font-medium transition-colors"
                >
                  Close
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
