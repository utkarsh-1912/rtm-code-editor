import React, { useEffect, useRef } from "react";
import Codemirror from "codemirror";
import "codemirror/lib/codemirror.css";
import "codemirror/addon/edit/closetag";
import "codemirror/addon/edit/closebrackets";
import "codemirror/mode/javascript/javascript";
// import "codemirror/theme/cobalt.css";
import "codemirror/theme/blackboard.css";
import ACTIONS from "../Action";

function EditorComp({ socketRef, roomId, onCodeChange }) {
  const editorRef = useRef(null);

  useEffect(() => {
    async function init() {
      editorRef.current = Codemirror.fromTextArea(
        document.getElementById("realTimeEditor"),
        {
          mode: { name: "javascript", json: true },
          theme: "blackboard",
          autoCloseTags: true,
          autoCloseBrackets: true,
          lineNumbers: true,
        }
      );

      editorRef.current.on("change", (instance, changes) => {
        console.log(changes);
        const { origin } = changes;
        const code = instance.getValue();
        onCodeChange(code);
        if (origin !== "setValue") {
          socketRef.current.emit(ACTIONS.CODE_CHANGE, {
            roomId,
            code,
          });
        }
        console.log(code);
      });
      // editorRef.current.setValue(
      //   "// WELCOME TO UTKRISTI COLABS @ UTKRISTI.IO \n"
      // );
    }
    init();
  }, []);

  useEffect(() => {
    if (socketRef.current) {
      socketRef.current.on(ACTIONS.CODE_CHANGE, ({ code }) => {
        if (code !== null) {
          editorRef.current.setValue(code);
        }
      });
    }

    // return () => {
    //   socketRef.current.off(ACTIONS.CODE_CHANGE);
    // };
  }, [socketRef.current]);

  return <textarea id="realTimeEditor" />;
}

export default EditorComp;
