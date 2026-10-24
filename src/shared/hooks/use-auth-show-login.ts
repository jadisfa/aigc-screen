import { useState } from 'react';

export const useAuthShowLoginDialog = (initialValue: boolean = false) => {
  const [showLogin, setShowLogin] = useState(initialValue);
  
  return {
    showLogin,
    setShowLogin,
    // 快捷方法
    openLogin: () => setShowLogin(true),
    closeLogin: () => setShowLogin(false),
    toggleLogin: () => setShowLogin(prev => !prev),
  };
};