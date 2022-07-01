import React from "react";
import Avatar from "react-avatar";

function Client(props) {
  return (
    <div className="client">
      <Avatar name={props.userName} size={45} round="10px" />
      <span className="username">{props.userName}</span>
    </div>
  );
}

export default Client;
