import "./App.css";
import MarioGame from "./components/MarioGame.tsx";
import { useState } from "react";

function App() {
  const [darkMode, setDarkMode] = useState(false);

  return (
    <div className={`App ${darkMode ? "dark-mode" : ""}`}>
      <MarioGame onDarkModeChange={setDarkMode} />
    </div>
  );
}

export default App;
// I have changed this
