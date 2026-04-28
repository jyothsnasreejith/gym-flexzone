import { useState } from "react";
import { useNavigate } from "react-router-dom";
import TrainerForm from "../components/TrainerForm";
import { supabase } from "../supabaseClient";

export default function AddTrainer() {
  const navigate = useNavigate();
  const [photoFile, setPhotoFile] = useState(null);
  const [cvFile, setCvFile] = useState(null);
  const [idProof1File, setIdProof1File] = useState(null);

  const uploadTrainerPhoto = async (trainerId) => {
    if (!photoFile) return null;

    const ext = photoFile.name.split(".").pop();
    const fileName = `trainer-${trainerId}-${Date.now()}.${ext}`;

    const { error: uploadError } = await supabase.storage
      .from("trainer-avatars")
      .upload(fileName, photoFile, { upsert: true });

    if (uploadError) throw uploadError;

    const { data } = supabase.storage
      .from("trainer-avatars")
      .getPublicUrl(fileName);

    return data.publicUrl;
  };

  const uploadDocument = async (trainerId, file, docType) => {
    if (!file) return null;
    const ext = file.name.split(".").pop();
    const fileName = `trainer-${trainerId}-${docType}-${Date.now()}.${ext}`;

    const { error: uploadError } = await supabase.storage
      .from("trainer-documents")
      .upload(fileName, file, { upsert: true });

    if (uploadError) throw uploadError;

    const { data } = supabase.storage
      .from("trainer-documents")
      .getPublicUrl(fileName);

    return data.publicUrl;
  }

  /* =========================
     SUBMIT HANDLER
  ========================= */
  const submit = async (payload, documentFiles) => {
    const { data, error } = await supabase
      .from("trainers")
      .insert(payload) // Pass object instead of array
      .select()
      .single();

    if (error) {
      console.error("ADD TRAINER FAILED:", error);
      console.error("Error Message:", error.message);
      console.error("Error Details:", error.details);
      console.error("Error Hint:", error.hint);
      console.error("Error Code:", error.code);
      alert(`Failed to create trainer: ${error.message}`);
      return;
    }

    const trainerId = data.id;
    const updates = {};

    if (photoFile) {
      try {
        const imageUrl = await uploadTrainerPhoto(trainerId);
        if (imageUrl) {
          updates.profile_image_url = imageUrl;
        }
      } catch (err) {
        console.error("PHOTO UPLOAD FAILED:", err);
        alert("Trainer created, but photo upload failed");
      }
    }

    const docUploads = [
      { file: documentFiles.cvFile, type: "cv_url" },
      { file: documentFiles.idProof1File, type: "id_proof_1_url" },
    ];

    for (const upload of docUploads) {
      if (upload.file) {
        try {
          const url = await uploadDocument(trainerId, upload.file, upload.type);
          if (url) {
            updates[upload.type] = url;
          }
        } catch (err) {
          console.error(`${upload.type} UPLOAD FAILED:`, err);
          alert(`Trainer created, but ${upload.type} upload failed`);
        }
      }
    }

    if (Object.keys(updates).length > 0) {
      const { error: updateError } = await supabase
        .from("trainers")
        .update(updates)
        .eq("id", trainerId);

      if (updateError) {
        console.error("TRAINER UPDATE FAILED:", updateError);
        alert("Trainer created, but failed to save document URLs");
      }
    }

    navigate("/trainers");
  };

  /* =========================
     RENDER
  ========================= */
  return (
    <div className="mx-auto w-full px-4 sm:px-6 py-6 bg-navy">
      <div className="flex items-center mb-6">
        <button
          onClick={() => navigate(-1)}
          className="p-2 rounded-full hover:bg-slate-800/30"
          aria-label="Go back"
        >
          <span className="material-icons-round">arrow_back</span>
        </button>
        <h1 className="text-2xl font-bold ml-2">Onboard New Trainer</h1>
      </div>
      <TrainerForm
        onSubmit={submit}
        submitLabel="Create Trainer Profile"
        photoFile={photoFile}
        setPhotoFile={setPhotoFile}
        cvFile={cvFile}
        setCvFile={setCvFile}
        idProof1File={idProof1File}
        setIdProof1File={setIdProof1File}
      />
    </div>
  );
}
