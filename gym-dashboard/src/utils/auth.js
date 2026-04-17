export const getAuthUser = () => {
  try {
    return JSON.parse(localStorage.getItem("auth_user"));
  } catch {
    return null;
  }
};

export const logout = () => {
  localStorage.removeItem("auth_user");
  window.location.href = "/login";
};
