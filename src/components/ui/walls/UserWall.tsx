export default function UserWall({ initialData }: { initialData: any }) {
  const wallEntries = [
    {
      type: "activated",
      text: "activated",
      timestamp: initialData.user.wall.activatedAt,
    },
    {
      type: "mint",
      text: "minted",
      timestamp: initialData.user.wall.createdAt,
    },
  ];

  return (
    <div className="fixed grow bottom-0 w-full bg-[#22036A] p-4 z-50">
      <div className="w-full h-full pt-4">
        <div className="w-5/6 mx-auto">
          <div className="relative">
            <img
              src={
                initialData.user.wall.wallImage ||
                initialData.user.wall.farcasterProfile.pfp_url
              }
              alt="pfp"
              className="w-full aspect-square mx-auto rounded-2xl"
            />
            <p className="absolute top-1 left-1 p-2 text-black">
              #{initialData.user.wall.index}
            </p>
          </div>
          <div className="text-white text-2xl font-bold">
            {initialData.username}
          </div>
          <div className="text-white text-2xl font-bold">
            {initialData.username}
          </div>
        </div>
        <div className="w-full mx-auto h-full">
          {wallEntries.map((entry) => (
            <div
              key={entry.type}
              className="flex w-full h-16 bg-[#CB45F6] rounded-xl my-2 justify-between text-black"
            >
              <p>{entry.text}</p>
              <p>{entry.timestamp}</p>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
