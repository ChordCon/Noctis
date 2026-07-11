import React, { useState } from "react";

const HomeVisual = ({ videoSrc, thumbSrc, className }) => {
  // 처음부터 'playing' 상태로 시작하게 합니다.
  const [videoStatus, setVideoStatus] = useState("playing");

  const handleVideoEnded = () => {
    // 영상이 끝나면 'finished' 상태로 변경
    setVideoStatus("finished");
  };

  return (
    <div className={className}>
      {videoStatus === "playing" ? (
        <video
          src={videoSrc}
          autoPlay
          muted
          playsInline
          onEnded={handleVideoEnded}
          style={{
            width: "100%",
            height: "100%",
            objectFit: "cover",
            transform: "scale(1.78)", // 160% 확대와 동일한 효과
          }}
        />
      ) : (
        <img
          src={thumbSrc}
          alt="로고 미리보기"
          style={{ width: "100%", height: "100%", objectFit: "cover" }}
        />
      )}
    </div>
  );
};

export default HomeVisual;
