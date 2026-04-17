import { createContext, useContext, useState } from "react";

const ModalContext = createContext(null);

export const useModal = () => useContext(ModalContext);

export const ModalProvider = ({ children }) => {
  const [modalContent, setModalContent] = useState(null);

  const openModal = (content) => setModalContent(content);
  const closeModal = () => setModalContent(null);

  return (
    <ModalContext.Provider value={{ openModal, closeModal }}>
      {children}

      {modalContent && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40">
          {modalContent}
        </div>
      )}
    </ModalContext.Provider>
  );
};
