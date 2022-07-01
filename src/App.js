import "./App.css";
import { BrowserRouter, Routes, Route } from "react-router-dom";
import HomePage from "./pages/main";
import Editor from "./pages/editor";
import { Toaster } from "react-hot-toast";

function App() {
  return (
    <>
      <div>
        <Toaster
          position="top-right"
          toastOptions={{ sucess: { theme: { primary: "#003bfb" } } }}
        ></Toaster>
      </div>
      <BrowserRouter>
        <Routes>
          <Route path="/" element={<HomePage />}></Route>
          <Route path="/editor/:roomId" element={<Editor />}></Route>
        </Routes>
      </BrowserRouter>
    </>
  );
}

export default App;
