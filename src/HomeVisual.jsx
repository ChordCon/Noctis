const HomeVisual = ({ videoSrc, thumbSrc, className }) => {
  return (
    <div className={className}>
      <video
        src={videoSrc}
        autoPlay
        muted
        playsInline
        onEnded={(e) => {
          e.target.pause(); // 명시적으로 정지
          // 필요하다면 여기서 상태값을 바꿔 이미지를 완전히 보이게 할 수 있음
        }}
        style={{
          width: "100%",
          height: "100%",
          objectFit: "cover",
          transform: "scale(1.78)", // 160% 확대와 동일한 효과
        }}
      />
    </div>
  );
};

export default HomeVisual;
