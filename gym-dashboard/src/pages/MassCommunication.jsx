// src/pages/MassCommunication.jsx
import React, { useState } from "react";

export default function MassCommunication() {
  const [messageMode, setMessageMode] = useState("sms");
  const [selectedTemplate, setSelectedTemplate] = useState("Fee Due Reminder");
  const [templateContent, setTemplateContent] = useState(
    "Hi [MEMBER_NAME], your GymFlow fee is due on [DUE_DATE]. Please pay by [LINK]. Thanks!"
  );
  const [targetCount, setTargetCount] = useState(185);

  const updateTemplateContent = (template) => {
    setSelectedTemplate(template);

    if (template === "Fee Due Reminder") {
      setTemplateContent(
        "Hi [MEMBER_NAME], your GymFlow fee is due on [DUE_DATE]. Please pay by [LINK]. Thanks!"
      );
    } else if (template === "Offer: New Class") {
      setTemplateContent(
        "Great news, [MEMBER_NAME]! We are launching the new [CLASS_NAME] class. Book your spot today! [LINK]"
      );
    } else if (template === "Birthday Wish") {
      setTemplateContent(
        "Happy Birthday, [MEMBER_NAME]! Enjoy a free PT session on us this week. Keep training hard!"
      );
    } else {
      setTemplateContent("");
    }
  };

  const calculateTargetCount = () => {
    setTargetCount(Math.floor(Math.random() * (350 - 50 + 1)) + 50);
  };

  const sendCampaign = (e) => {
    e.preventDefault();
    alert(`Simulated send to ${targetCount} members using: ${selectedTemplate}`);
  };

  return (
    <div className="flex-1 p-8 bg-navy">
      <div className="mx-auto w-full">

        {/* Page Title */}
        <div className="mb-8">
          <h1 className="text-3xl font-bold text-white">
            Mass Communication
          </h1>
          <p className="text-secondary">
            Send targeted messages to member segments via SMS or WhatsApp.
          </p>
        </div>

        {/* ========== Create New Campaign Card ========== */}
        <div className="bg-card rounded-2xl shadow-sm p-8 mb-10 border border-slate-700/20">
          <h2 className="text-xl font-bold text-[#0d6dfd] pb-4 mb-6 border-b border-slate-700/20">
            Create New Campaign
          </h2>

          <form className="space-y-8" onSubmit={sendCampaign}>

            {/* ----------- Target Filters ----------- */}
            <div className="border-b border-slate-700/20 pb-8">
              <h3 className="text-lg font-semibold text-white mb-4">
                Targeting Filters (Optional)
              </h3>

              <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 gap-6">

                {/* Area */}
                <div>
                  <label className="block text-sm font-medium text-white mb-1">
                    Area / Locality
                  </label>
                  <select
                    onChange={calculateTargetCount}
                    className="w-full rounded-lg border-gray-300 focus:ring-primary focus:border-primary"
                  >
                    <option>All Areas</option>
                    <option>Koramangala</option>
                    <option>Indiranagar</option>
                    <option>HSR Layout</option>
                  </select>
                </div>

                {/* Packages */}
                <div>
                  <label className="block text-sm font-medium text-white mb-1">
                    Packages
                  </label>
                  <select
                    onChange={calculateTargetCount}
                    className="w-full rounded-lg border-gray-300 focus:ring-primary focus:border-primary"
                  >
                    <option>All Active Packages</option>
                    <option>Monthly</option>
                    <option>Annual</option>
                    <option>PT Add-ons</option>
                  </select>
                </div>

                {/* Gender */}
                <div>
                  <label className="block text-sm font-medium text-white mb-1">
                    Gender
                  </label>
                  <select
                    onChange={calculateTargetCount}
                    className="w-full rounded-lg border-gray-300 focus:ring-primary focus:border-primary"
                  >
                    <option>All Genders</option>
                    <option>Male</option>
                    <option>Female</option>
                  </select>
                </div>

                {/* Age Group */}
                <div>
                  <label className="block text-sm font-medium text-white mb-1">
                    Age Group (e.g., 18–35)
                  </label>

                  <div className="flex gap-2">
                    <input
                      type="number"
                      placeholder="Min"
                      onInput={calculateTargetCount}
                      className="w-1/2 rounded-lg border-gray-300 focus:ring-primary focus:border-primary"
                    />
                    <input
                      type="number"
                      placeholder="Max"
                      onInput={calculateTargetCount}
                      className="w-1/2 rounded-lg border-gray-300 focus:ring-primary focus:border-primary"
                    />
                  </div>
                </div>
              </div>

              <p className="text-sm font-semibold text-secondary mt-4">
                Targeted Members:{" "}
                <span className="text-[#0d6dfd] text-xl font-bold">
                  {targetCount}
                </span>
              </p>
            </div>

            {/* -------- Messaging Mode + Templates ------- */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-8">

              {/* Messaging Mode */}
              <div>
                <h3 className="text-sm font-medium text-white mb-2">
                  Messaging Mode
                </h3>

                <div className="flex gap-4">

                  {/* SMS Option */}
                  <label
                    className={`flex items-center gap-2 px-4 py-3 border-2 rounded-lg cursor-pointer ${messageMode === "sms"
                        ? "border-primary bg-primary/10"
                        : "border-gray-300"
                      }`}
                  >
                    <input
                      type="radio"
                      name="mode"
                      value="sms"
                      checked={messageMode === "sms"}
                      onChange={() => setMessageMode("sms")}
                    />
                    <span className="material-symbols-outlined text-primary">
                      sms
                    </span>
                    <span className="text-sm font-medium">SMS (Standard Text)</span>
                  </label>

                  {/* WhatsApp Option */}
                  <label
                    className={`flex items-center gap-2 px-4 py-3 border-2 rounded-lg cursor-pointer ${messageMode === "whatsapp"
                        ? "border-green-500 bg-green-50"
                        : "border-gray-300"
                      }`}
                  >
                    <input
                      type="radio"
                      name="mode"
                      value="whatsapp"
                      checked={messageMode === "whatsapp"}
                      onChange={() => setMessageMode("whatsapp")}
                    />
                    <span className="material-symbols-outlined text-green-500">
                      chat
                    </span>
                    <span className="text-sm font-medium">WhatsApp (API)</span>
                  </label>
                </div>
              </div>

              {/* Template Selector */}
              <div>
                <label className="block text-sm font-medium text-white mb-1">
                  Choose Template
                </label>

                <select
                  onChange={(e) => updateTemplateContent(e.target.value)}
                  className="w-full rounded-lg border-gray-300 focus:ring-primary focus:border-primary"
                >
                  <option>Fee Due Reminder</option>
                  <option>Offer: New Class</option>
                  <option>Birthday Wish</option>
                  <option>Custom</option>
                </select>
              </div>
            </div>

            {/* -------- Template Content Box -------- */}
            <div>
              <h3 className="text-sm font-medium text-white mb-2">
                Template Content Preview / Edit
              </h3>

              <textarea
                value={templateContent}
                onChange={(e) => setTemplateContent(e.target.value)}
                rows="4"
                className="w-full rounded-lg border-gray-300 focus:ring-primary focus:border-primary text-sm"
              />

              <p className="text-xs text-secondary mt-1">
                Variables like [MEMBER_NAME] will be dynamically replaced. Character Count:
                {templateContent.length}
              </p>
            </div>

            {/* Submit Button */}
            <div className="flex justify-end">
              <button
                type="submit"
                className="px-6 py-3 bg-primary text-white font-semibold rounded-lg shadow-sm hover:bg-blue-600 flex items-center gap-2"
              >
                <span className="material-symbols-outlined">send</span>
                Send Campaign to {targetCount} Members
              </button>
            </div>
          </form>
        </div>

        {/* ========== Campaign History ========== */}
        <div className="bg-card rounded-2xl shadow-sm border border-slate-700/20 overflow-hidden">
          <div className="p-6">
            <h2 className="text-xl font-bold text-white">Campaign History</h2>
          </div>

          <div className="overflow-x-auto hidden md:block">
            <table className="w-full min-w-full">
              <thead className="bg-slate-800/50">
                <tr>
                  <th className="px-6 py-3 text-left text-xs font-medium text-secondary uppercase">
                    Date Sent
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-secondary uppercase">
                    Template/Subject
                  </th>
                  <th className="px-6 py-3 text-center text-xs font-medium text-secondary uppercase">
                    Mode
                  </th>
                  <th className="px-6 py-3 text-center text-xs font-medium text-secondary uppercase">
                    Targeted
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-secondary uppercase">
                    Status
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-secondary uppercase">
                    Actions
                  </th>
                </tr>
              </thead>

              <tbody className="divide-y divide-gray-100">
                {/* Example row */}
                <tr className="hover:bg-slate-800/50">
                  <td className="px-6 py-4 text-secondary text-sm">
                    Oct 25, 2023 10:30 AM
                  </td>
                  <td className="px-6 py-4 text-white text-sm font-medium">
                    Fee Due Reminder
                  </td>
                  <td className="px-6 py-4 text-center">
                    <span className="material-symbols-outlined text-green-500">
                      chat
                    </span>
                  </td>
                  <td className="px-6 py-4 text-center text-sm text-secondary">
                    145
                  </td>
                  <td className="px-6 py-4">
                    <span className="px-3 py-1 text-xs font-medium rounded-full bg-green-100 text-green-600">
                      Sent (140 Delivered)
                    </span>
                  </td>
                  <td className="px-6 py-4">
                    <button className="text-primary font-medium flex items-center gap-1">
                      <span className="material-symbols-outlined text-lg">
                        visibility
                      </span>
                      Details
                    </button>
                  </td>
                </tr>

                {/* Add more rows as needed */}
              </tbody>
            </table>
          </div>
          {/* Mobile Card View */}
          <div className="md:hidden">
            <div className="border-t">
              {/* Example Card */}
              <div className="p-4 border-b">
                <div className="flex justify-between items-start">
                  <div>
                    <div className="font-semibold text-sm text-white">Fee Due Reminder</div>
                    <div className="text-xs text-secondary">Oct 25, 2023 10:30 AM</div>
                  </div>
                  <span className="px-3 py-1 text-xs font-medium rounded-full bg-green-100 text-green-600">
                    Sent
                  </span>
                </div>
                <div className="mt-4 flex justify-between items-center">
                  <div className="flex items-center gap-4 text-sm">
                    <div className="flex items-center gap-1">
                      <span className="material-symbols-outlined text-green-500 text-base">chat</span>
                      <span>WhatsApp</span>
                    </div>
                    <div>
                      <span className="font-semibold">145</span>
                      <span className="text-secondary"> Targeted</span>
                    </div>
                  </div>
                  <button className="text-primary font-medium flex items-center gap-1">
                    <span className="material-symbols-outlined text-lg">visibility</span>
                    Details
                  </button>
                </div>
              </div>
              {/* Add more cards as needed */}
            </div>
          </div>
        </div>

      </div>
    </div>
  );
}
