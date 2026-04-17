import React from 'react';

const WHATSAPP_NUMBER = '595985981046';
const MESSAGE = 'Olá! Gostaria de tirar uma dúvida. 😊';

const WhatsAppButton: React.FC = () => {
  const url = `https://wa.me/${WHATSAPP_NUMBER}?text=${encodeURIComponent(MESSAGE)}`;

  return (
    <a
      href={url}
      target="_blank"
      rel="noopener noreferrer"
      aria-label="Falar pelo WhatsApp"
      style={{ zIndex: 999999 }}
      className="fixed bottom-[88px] right-6 flex items-center justify-center w-14 h-14 rounded-full shadow-xl bg-[#25D366] hover:bg-[#1ebe5d] active:scale-95 transition-all duration-200"
    >
      <svg
        xmlns="http://www.w3.org/2000/svg"
        viewBox="0 0 32 32"
        className="w-8 h-8 fill-white"
      >
        <path d="M16.003 2.667C8.637 2.667 2.667 8.637 2.667 16c0 2.363.627 4.674 1.817 6.694L2.667 29.333l6.82-1.787A13.27 13.27 0 0 0 16.003 29.333C23.37 29.333 29.333 23.363 29.333 16S23.37 2.667 16.003 2.667zm0 24.267a11.01 11.01 0 0 1-5.617-1.543l-.403-.24-4.047 1.06 1.08-3.94-.263-.413A10.987 10.987 0 0 1 5.04 16c0-6.04 4.923-10.96 10.963-10.96S26.96 9.96 26.96 16s-4.917 10.933-10.957 10.933zm6.007-8.193c-.33-.167-1.953-.963-2.257-1.073-.303-.11-.523-.167-.743.167-.22.33-.853 1.073-1.047 1.293-.193.22-.387.247-.717.083-.33-.167-1.393-.513-2.653-1.637-.98-.873-1.643-1.953-1.837-2.283-.193-.33-.02-.51.147-.673.15-.147.33-.387.497-.58.167-.193.22-.33.33-.55.11-.22.055-.413-.027-.58-.083-.167-.743-1.793-1.017-2.453-.267-.643-.54-.557-.743-.567l-.633-.01c-.22 0-.577.083-.88.413-.303.33-1.153 1.127-1.153 2.747s1.18 3.187 1.343 3.407c.167.22 2.32 3.54 5.62 4.963.787.34 1.4.543 1.877.693.787.25 1.503.217 2.07.133.633-.093 1.953-.797 2.227-1.567.273-.77.273-1.43.193-1.567-.08-.137-.3-.22-.63-.387z" />
      </svg>
    </a>
  );
};

export default WhatsAppButton;
