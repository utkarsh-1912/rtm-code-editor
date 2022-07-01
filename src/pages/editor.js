import React, { useState, useRef, useEffect } from "react";
import {
  useNavigate,
  useLocation,
  Navigate,
  useParams,
} from "react-router-dom";
import ACTIONS from "../Action";
import Client from "../components/clients";
import EditorComp from "../components/editorComp";
import { initSocket } from "../socket";
import toast from "react-hot-toast";

function Editor() {
  const socketRef = useRef(null);
  const codeRef = useRef(null);
  const location = useLocation();
  const reactNavigator = useNavigate();
  const { roomId } = useParams();

  const [clients, setClients] = useState([]);

  useEffect(() => {
    const init = async () => {
      socketRef.current = await initSocket();
      socketRef.current.on("connect_error", (err) => handleErrors(err));
      socketRef.current.on("connect_failed", (err) => handleErrors(err));

      function handleErrors(err) {
        console.log("socket error", err);
        toast.error("Socket Connection failed. Try Again !!");
        reactNavigator("/");
      }

      socketRef.current.emit(ACTIONS.JOIN, {
        roomId,
        userName: location.state?.userName,
      });

      // Listen Joined User
      socketRef.current.on(
        ACTIONS.JOINED,
        ({ clients, userName, socketId }) => {
          if (userName !== location.state?.userName) {
            toast.success(`${userName} joined !`);
          }
          setClients(clients);
          socketRef.current.emit(ACTIONS.SYNC_CODE, {
            socketId,
            code: codeRef.current,
          });
        }
      );

      // Listen Disconnected User
      socketRef.current.on(ACTIONS.DISCONNECTED, ({ socketId, userName }) => {
        toast.error(`${userName} left the room !`);
        setClients((prev) => {
          return prev.filter((client) => {
            return client.socketId !== socketId;
          });
        });
      });
    };

    init();

    // Cleaning function
    // return () => {
    //   socketRef.current.disconnect();
    //   socketRef.current.off(ACTIONS.JOINED);
    //   socketRef.current.off(ACTIONS.DISCONNECTED);
    // };
  }, [socketRef]);

  if (!location.state) {
    return <Navigate to="/" />;
  }

  async function copyRoomId() {
    try {
      await navigator.clipboard.writeText(roomId);
      toast.success("Room Id copied to clipboard", {
        style: { fontFamily: "Arima", fontWeight: "bold" },
      });
    } catch (err) {
      toast.error("Unable to copy ROOM ID");
      console.log(err);
    }
  }

  const leaveRoom = () => {
    socketRef.current.disconnect();
    socketRef.current.off(ACTIONS.JOINED);
    socketRef.current.off(ACTIONS.DISCONNECTED);
    reactNavigator("/");
  };

  return (
    <div className="mainWrap">
      <div className="aside">
        <div className="asideInner">
          <div className="logo">
            <img
              className="logoImg"
              src="/utkristi-colabs.png"
              alt="utkristi-labs-logo"
              style={{ backgroundColor: "white" }}
            ></img>
            <h3>Connected</h3>
            <div className="clientList">
              {clients.map((client) => {
                return (
                  <Client key={client.socketId} userName={client.userName} />
                );
              })}
            </div>
          </div>
        </div>
        <button className="btn copyBtn" onClick={copyRoomId}>
          Copy ROOM ID
        </button>
        <button className="btn leaveBtn" onClick={leaveRoom}>
          Leave ROOM
        </button>
      </div>
      <div className="EditorWrap">
        <EditorComp
          socketRef={socketRef}
          roomId={roomId}
          onCodeChange={(code) => {
            codeRef.current = code;
          }}
        />
      </div>
    </div>
  );
}

export default Editor;
