"use client";

import { useState, useRef, useEffect } from "react";
import { PhoneInput, CountrySelector } from "react-international-phone";
import { submitRegistration } from "./actions";
import "react-international-phone/style.css";
import HCaptcha from "@hcaptcha/react-hcaptcha";
import { PhoneNumberUtil } from "google-libphonenumber";

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

// ─── Custom Select Component ────────────────────────────────────────────────
interface CustomSelectProps {
  id?: string;
  name: string;
  value: string;
  onChange: (value: string) => void;
  options: { value: string; label: string }[];
  placeholder?: string;
  hasError?: boolean;
}

function CustomSelect({
  id,
  name,
  value,
  onChange,
  options,
  placeholder = "Select an option",
  hasError,
}: CustomSelectProps) {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    function handleClickOutside(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) {
        setOpen(false);
      }
    }
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  const selected = options.find((o) => o.value === value);

  return (
    <div ref={ref} className="relative w-full">
      {/* Hidden native input for form submission */}
      <input type="hidden" name={name} value={value} />

      {/* Trigger button — exact same look as other form inputs */}
      <button
        type="button"
        id={id}
        onClick={() => setOpen((p) => !p)}
        style={{
          backgroundColor: "rgba(15, 23, 42, 0.24)",
          color: "#f8fafc",
          border: hasError
            ? "1px solid rgb(239, 68, 68)"
            : "1px solid rgba(148, 163, 184, 0.25)",
          borderRadius: "12px",
          boxShadow: "inset 0 1px 2px rgba(15, 23, 42, 0.35)",
          padding: "0.75rem 1rem",
          width: "100%",
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
          gap: "8px",
          cursor: "pointer",
          outline: "none",
          transition: "border-color 0.2s",
          fontSize: "1rem",
          textAlign: "left",
        }}
        onFocus={(e) =>
          (e.currentTarget.style.border = "1px solid #22c55e")
        }
        onBlur={(e) =>
          (e.currentTarget.style.border = hasError
            ? "1px solid rgb(239, 68, 68)"
            : "1px solid rgba(148, 163, 184, 0.25)")
        }
      >
        <span style={{ color: selected ? "#f8fafc" : "#94a3b8" }}>
          {selected ? selected.label : placeholder}
        </span>
        <svg
          style={{
            width: "16px",
            height: "16px",
            color: "#94a3b8",
            flexShrink: 0,
            transform: open ? "rotate(180deg)" : "rotate(0deg)",
            transition: "transform 0.2s",
          }}
          fill="none"
          viewBox="0 0 24 24"
          stroke="currentColor"
          strokeWidth={2}
        >
          <path strokeLinecap="round" strokeLinejoin="round" d="M19 9l-7 7-7-7" />
        </svg>
      </button>

      {/* Dropdown panel */}
      {open && (
        <div
          style={{
            position: "absolute",
            zIndex: 50,
            marginTop: "4px",
            width: "100%",
            backgroundColor: "#1a2535",
            border: "1px solid rgba(148, 163, 184, 0.25)",
            borderRadius: "12px",
            boxShadow: "0 20px 40px rgba(0,0,0,0.4)",
            overflow: "hidden",
          }}
        >
          <ul
            className="custom-select-list"
            style={{ maxHeight: "208px", overflowY: "auto", padding: "4px 0" }}
          >
            {options.map((opt) => (
              <li
                key={opt.value}
                onClick={() => {
                  onChange(opt.value);
                  setOpen(false);
                }}
                style={{
                  padding: "10px 16px",
                  fontSize: "0.875rem",
                  cursor: "pointer",
                  color: value === opt.value ? "#22c55e" : "#e2e8f0",
                  backgroundColor:
                    value === opt.value
                      ? "rgba(34, 197, 94, 0.12)"
                      : "transparent",
                  fontWeight: value === opt.value ? 500 : 400,
                  transition: "background-color 0.15s",
                }}
                onMouseEnter={(e) => {
                  if (value !== opt.value)
                    e.currentTarget.style.backgroundColor =
                      "rgba(71, 85, 105, 0.5)";
                }}
                onMouseLeave={(e) => {
                  if (value !== opt.value)
                    e.currentTarget.style.backgroundColor = "transparent";
                }}
              >
                {opt.label}
              </li>
            ))}
          </ul>
        </div>
      )}
    </div>
  );
}

// ─── Main Form ───────────────────────────────────────────────────────────────
export default function RegistrationForm() {
  const [state, setState] = useState<FormState>({ message: "", errors: {} });
  const [isSubmitting, setIsSubmitting] = useState<boolean>(false);
  const [country, setCountry] = useState<string>("ae");
  const [countryName, setCountryName] = useState<string>("United Arab Emirates");
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

  // Custom select states
  const [prefix, setPrefix] = useState<string>("Mr.");
  const [mainObjective, setMainObjective] = useState<string>("");
  const [consentChecked, setConsentChecked] = useState(false);

  // Success popup
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
      ].includes(name) &&
      !value
    ) {
      return "This field is required";
    }
    if (name === "mobile") {
      if (!value) return "This field is required";
      if (!isPhoneValid(value)) return "Please enter a valid phone number";
    }
    if (name === "consent" && !consentChecked) {
      return "You must agree to the privacy policy";
    }
    if (name === "promocode") {
      if (!value) return "Promocode is required";
      if (value.trim().length < 3) return "Please enter a valid promocode";
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
      { name: "mainObjective", value: mainObjective },
      { name: "promocode", value: form.promocode?.value },
      { name: "consent", value: consentChecked ? "on" : "" },
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
    formData.append("mainObjective", mainObjective);
    formData.append("prefix", prefix);
    formData.append("promocode", form.promocode?.value || "");
    formData.append("captchaToken", hcaptchaToken);

    const result = await submitRegistration(state, formData);
    setState(result);
    setIsSubmitting(false);
    if (result.message.includes("success")) {
      setShowSuccessPopup(true);
      if (formRef.current) formRef.current.reset();
      setMobile("");
      setHcaptchaToken("");
      setErrors({});
      setFormMessage("");
      setFormMessageType("");
      setMainObjective("");
      setConsentChecked(false);
      setPrefix("Mr.");
    } else {
      setFormMessage(result.message);
      setFormMessageType("error");
    }
  };

  const closeSuccessPopup = () => setShowSuccessPopup(false);

  return (
    <div className="min-h-screen bg-transparent py-6 px-4 sm:px-6 lg:px-8">
      <div className="max-w-7xl mx-auto">
        <div className="flex justify-center items-center min-h-[calc(100vh-4rem)]">
          <div className="w-full max-w-3xl">
            <div className="space-y-4">
              <div className="bg-slate-900/70 border border-white/10 shadow-2xl rounded-[32px] flex flex-col justify-center h-full backdrop-blur-xl">
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
                          htmlFor="prefix-select"
                          className="block text-white mb-1 font-medium"
                        >
                          Prefix
                        </label>
                        <CustomSelect
                          id="prefix-select"
                          name="prefix"
                          value={prefix}
                          onChange={setPrefix}
                          options={[
                            { value: "Mr.", label: "Mr." },
                            { value: "Mrs.", label: "Mrs." },
                            { value: "Ms.", label: "Ms." },
                            { value: "Dr.", label: "Dr." },
                            { value: "Prof.", label: "Prof." },
                          ]}
                          placeholder="Prefix"
                        />
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

                      {/* Country — exact same visual footprint as phone input */}
                      <div className="space-y-1">
                        <label className="block text-white mb-1 font-medium">
                          Country
                        </label>
                        {/* Wrapper uses exact same inline styles as the inputs */}
                        <div
                          style={{
                            backgroundColor: "rgba(15, 23, 42, 0.24)",
                            border: "1px solid rgba(148, 163, 184, 0.25)",
                            borderRadius: "12px",
                            boxShadow: "inset 0 1px 2px rgba(15, 23, 42, 0.35)",
                            display: "flex",
                            alignItems: "stretch",
                            width: "100%",
                            height: "51px",
                          }}
                        >
                          {/* Flag selector — same height as wrapper */}
                          <div
                            style={{
                              display: "flex",
                              alignItems: "center",
                              height: "100%",
                            }}
                          >
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
                              buttonClassName="country-flag-btn bg-transparent border-0 shadow-none focus:outline-none text-slate-100"
                              buttonStyle={{
                                height: "100%",
                                padding: "0 14px",
                                background: "transparent",
                                border: "none",
                                boxShadow: "none",
                                outline: "none",
                              }}
                            />
                          </div>
                          {/* Country name text */}
                          <input
                            id="country"
                            type="text"
                            value={countryName}
                            readOnly
                            placeholder="Select country"
                            style={{
                              flex: 1,
                              background: "transparent",
                              border: "none",
                              outline: "none",
                              color: "#f8fafc",
                              fontSize: "1rem",
                              cursor: "default",
                              padding: "0",
                              boxShadow: "none",
                            }}
                          />
                        </div>
                        {submitted && errors.country && (
                          <p className="text-red-500 text-xs pt-1">
                            {errors.country}
                          </p>
                        )}
                      </div>
                    </div>

                    {/* Main Objective — dropdown, full width */}
                    <div className="space-y-1">
                      <label
                        htmlFor="mainObjective-select"
                        className="block text-white mb-1 font-medium"
                      >
                        Main Objective for registering at AIAC WEST AFRICA{" "}
                        <span className="text-red-500">*</span>
                      </label>
                      <CustomSelect
                        id="mainObjective-select"
                        name="mainObjective"
                        value={mainObjective}
                        onChange={setMainObjective}
                        options={[
                          { value: "Asset Integrity", label: "Asset Integrity" },
                          { value: "Automation & Cybersecurity", label: "Automation & Cybersecurity" },
                        ]}
                        placeholder="Select your main objective"
                        hasError={submitted && !!errors.mainObjective}
                      />
                      {submitted && errors.mainObjective && (
                        <p className="text-red-500 text-xs pt-1">
                          {errors.mainObjective}
                        </p>
                      )}
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
                        maxLength={8}
                      />
                      {submitted && errors.promocode && (
                        <p className="text-rose-400 text-xs pt-1">
                          {errors.promocode}
                        </p>
                      )}
                    </div>

                    {/* Consent Section — modern custom checkbox */}
                    <div className="space-y-2">
                      <label className="block text-white mb-1 font-medium">
                        Consent <span className="text-red-500">*</span>
                      </label>

                      <label
                        htmlFor="consent"
                        className="flex items-start gap-3 cursor-pointer group"
                      >
                        {/* Hidden native checkbox */}
                        <input
                          type="checkbox"
                          id="consent"
                          name="consent"
                          checked={consentChecked}
                          onChange={(e) => setConsentChecked(e.target.checked)}
                          className="sr-only"
                        />

                        {/* Custom checkbox box */}
                        <div
                          className={`relative flex-shrink-0 w-6 h-6 mt-0.5 rounded-md border-2 transition-all duration-200 shadow-inner ${
                            consentChecked
                              ? "bg-[#22c55e] border-[#22c55e]"
                              : "bg-slate-800/60 border-slate-500 group-hover:border-[#22c55e]/70"
                          }`}
                        >
                          {/* Tick SVG — shown when checked */}
                          <svg
                            className={`absolute inset-0 w-full h-full p-0.5 text-white transition-opacity duration-150 ${
                              consentChecked ? "opacity-100" : "opacity-0"
                            }`}
                            viewBox="0 0 24 24"
                            fill="none"
                            stroke="currentColor"
                            strokeWidth={3}
                            strokeLinecap="round"
                            strokeLinejoin="round"
                          >
                            <path d="M5 13l4 4L19 7" />
                          </svg>
                        </div>

                        {/* Consent text */}
                        <span className="text-sm text-slate-200 leading-relaxed">
                          By submitting this form, you agree to the processing of
                          your personal data by Aldrich as described in the{" "}
                          <a
                            href="https://aldrichme.com/en/privacy-policy.html"
                            target="_blank"
                            rel="noopener noreferrer"
                            className="text-[#22c55e] underline underline-offset-2 hover:text-[#4ade80] transition-colors duration-150"
                            onClick={(e) => e.stopPropagation()}
                          >
                            privacy policy
                          </a>
                          .
                        </span>
                      </label>

                      {submitted && errors.consent && (
                        <p className="text-red-500 text-xs pt-1 flex items-center gap-1">
                          <svg className="w-3 h-3" fill="currentColor" viewBox="0 0 20 20">
                            <path fillRule="evenodd" d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-7 4a1 1 0 11-2 0 1 1 0 012 0zm-1-9a1 1 0 00-1 1v4a1 1 0 102 0V6a1 1 0 00-1-1z" clipRule="evenodd" />
                          </svg>
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
      </div>

      {/* Success Popup Modal */}
      {showSuccessPopup && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center z-50 p-4">
          <div className="bg-[#0A343D] rounded-2xl shadow-2xl max-w-md w-full mx-4 transform transition-all border border-emerald-900/30">
            <div className="p-8">
              {/* Success Icon */}
              <div className="flex items-center justify-center w-20 h-20 mx-auto mb-6 bg-emerald-500/10 rounded-full border-2 border-emerald-500/20">
                <svg
                  className="w-10 h-10 text-[#22c55e]"
                  fill="none"
                  stroke="currentColor"
                  viewBox="0 0 24 24"
                  xmlns="http://www.w3.org/2000/svg"
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth="3"
                    d="M5 13l4 4L19 7"
                  />
                </svg>
              </div>

              {/* Success Message */}
              <div className="text-center mb-8">
                <h3 className="text-2xl font-bold text-white mb-3">
                  Registration Successful!
                </h3>
                <p className="text-emerald-100/70 leading-relaxed">
                  Thank you for registering. Your submission has been received
                  successfully. We have sent a confirmation email to you.
                </p>
              </div>

              {/* Close Button */}
              <div className="space-y-3">
                <button
                  onClick={closeSuccessPopup}
                  className="w-full bg-[#22c55e] hover:bg-[#1f9a51] text-white py-4 px-4 rounded-xl font-bold text-lg transition-all duration-200 shadow-lg shadow-emerald-900/40 cursor-pointer"
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
