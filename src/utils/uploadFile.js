// File: src/utils/uploadFile.js
import { ref, uploadBytes, getDownloadURL } from "firebase/storage";
import { storage } from "../firebase";

export const uploadFile = async (file, path = "uploads") => {
  const fileRef = ref(storage, `${path}/${file.name}`);
  await uploadBytes(fileRef, file);
  const url = await getDownloadURL(fileRef);
  return url;
};
