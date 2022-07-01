import React, { useState } from "react";
import { v4 as uuid } from "uuid";
import toast, { Toaster } from "react-hot-toast";
import { useNavigate } from "react-router-dom";

function HomePage() {
  const navigate = useNavigate();
  const [roomId, setRoomId] = useState("");
  const [userName, setUserName] = useState("");
  function createNewRoom(e) {
    e.preventDefault();
    const id = uuid();
    setRoomId(id);
    toast.success("New Room Created !!", { iconTheme: { primary: "#003bfb" } });
  }

  const joinRoom = () => {
    if (!roomId || !userName) {
      toast.error("Room Id & Username are required.");
      return;
    }
    // To redirect to 'Editor' page
    navigate(`/editor/${roomId}`, {
      state: {
        userName,
      },
    });
  };

  function handleEnterKey(e) {
    if (e.code === "Enter") {
      joinRoom();
    }
  }
  return (
    <div className="homePageWrapper">
      <div className="formWrapper">
        <img
          className="logoImg"
          src="/utkristi-colabs.png"
          alt="utkristi-labs-logo"
        ></img>
        <h4 className="mainLabel">Paste Invitation Room Id</h4>
        <div className="inputGroup">
          <input
            type="text"
            name=""
            id=""
            className="inputBox"
            placeholder="ROOM ID"
            onChange={(e) => {
              setRoomId(e.target.value);
            }}
            value={roomId}
            onKeyUp={handleEnterKey}
          />
          <input
            type="text"
            name=""
            id=""
            className="inputBox"
            placeholder="USER NAME"
            onChange={(event) => {
              setUserName(event.target.value);
            }}
            value={userName}
            onKeyUp={handleEnterKey}
          />

          <button className="btn joinBtn" onClick={joinRoom}>
            Join
          </button>

          <span className="createInfo">
            If you don't have invite code , Create&nbsp;
            <a onClick={createNewRoom} href="" class="createNewBtn">
              New Room
            </a>
          </span>
        </div>
      </div>
      <footer>
        <h4>
          Build with 🧡 by{" "}
          <a href="https://utkarsh-1912.github.io/portfolio/">Utkristi.io</a>
        </h4>
      </footer>
    </div>
  );
}

export default HomePage;
