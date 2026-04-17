import { useModal } from "../context/ModalContext";

const GlobalModal = () => {
  const { modalContent, closeModal } = useModal();

  if (!modalContent) return null;

  return (
    <div className="fixed inset-0 z-50 md:z-[1000] flex items-center justify-center p-4">
      {/* Background overlay */}
      <div
        className="absolute inset-0 bg-black/50"
        onClick={closeModal}
      ></div>

      {/* Modal Content */}
      <div className="relative w-full max-w-lg md:max-w-xl bg-card rounded-xl shadow-xl">
        {modalContent}
      </div>
    </div>
  );
};

export default GlobalModal;
