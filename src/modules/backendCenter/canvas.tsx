const InfiniteCanvas = () => {
 return (
    <iframe 
    src="http://192.168.10.23:3000/canvas"
    style={{
          flex: 1,          // 撑满剩余高度
          width: '100%',
          height: '100%',
          border: 'none',   // 去掉默认的边框
          backgroundColor: '#fff'
        }}
        // 建议加上 allow 属性，如果画布内部需要用到剪贴板、摄像头等权限
        allow="clipboard-read; clipboard-write; camera; microphone" 
    />
 )
}

export default InfiniteCanvas;