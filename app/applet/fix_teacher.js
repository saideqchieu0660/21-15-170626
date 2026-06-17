const fs = require("fs");
let content = fs.readFileSync("src/pages/TeacherDashboard.tsx", "utf8");

content = content.replace(
  /const \[rewardLevels, setRewardLevels\] = useState\(""\);/,
  "const [rewardLevels, setRewardLevels] = useState(\"\");\n  const [rewardStreak, setRewardStreak] = useState(\"\");\n  const [rewardStudyMinutes, setRewardStudyMinutes] = useState(\"\");"
);

const oldHandleDispatch = `      const addPoints = parseInt(rewardPoints, 10) || 0;
      const addLevel = parseInt(rewardLevels, 10) || 0;
      
      const currentPoints = chosenUser.points || 0;
      const currentLevel = chosenUser.level || 1;
      
      const updatedPoints = Math.max(0, currentPoints + addPoints);
      const updatedLevel = Math.max(1, currentLevel + addLevel);
      
      await dbService.updateUserProfile(rewardTargetId, {
        points: updatedPoints,
        level: updatedLevel
      });
      
      // Update local state list
      setDbUsers(prev => prev.map(u => u.id === rewardTargetId ? { ...u, points: updatedPoints, level: updatedLevel } : u));
      
      // If of current Admin
      if (user && rewardTargetId === user.id) {
        store.updateCurrentUser({
          points: updatedPoints,
          level: updatedLevel
        });
        
        window.dispatchEvent(new CustomEvent("henosis-data-synced"));
      }
      
      setRewardMessage(\`Thành công! Đã ban tặng \${addPoints >= 0 ? '+' : ''}\${addPoints} Tinh Hoa (PT) và \${addLevel >= 0 ? '+' : ''}\${addLevel} cấp cấp độ (Level) cho \${chosenUser.name}!\`);
      
      // Clean up inputs
      setRewardPoints("");
      setRewardLevels("");`;

const newHandleDispatch = `      const addPoints = parseInt(rewardPoints, 10) || 0;
      const addLevel = parseInt(rewardLevels, 10) || 0;
      const addStreak = parseInt(rewardStreak, 10) || 0;
      const addStudyMinutes = parseInt(rewardStudyMinutes, 10) || 0;
      
      const currentPoints = chosenUser.points || 0;
      const currentLevel = chosenUser.level || 1;
      const currentStreak = chosenUser.streak || 0;
      const currentStudyMinutes = chosenUser.studyMinutes || 0;
      
      const updatedPoints = Math.max(0, currentPoints + addPoints);
      const updatedLevel = Math.max(1, currentLevel + addLevel);
      const updatedStreak = Math.max(0, currentStreak + addStreak);
      const updatedStudyMinutes = Math.max(0, currentStudyMinutes + addStudyMinutes);
      
      await dbService.updateUserProfile(rewardTargetId, {
        points: updatedPoints,
        level: updatedLevel,
        streak: updatedStreak,
        studyMinutes: updatedStudyMinutes
      });
      
      // Update local state list
      setDbUsers(prev => prev.map(u => u.id === rewardTargetId ? { 
         ...u, 
         points: updatedPoints, 
         level: updatedLevel,
         streak: updatedStreak,
         studyMinutes: updatedStudyMinutes
      } : u));
      
      // If of current Admin
      if (user && rewardTargetId === user.id) {
        store.updateCurrentUser({
          points: updatedPoints,
          level: updatedLevel,
          streak: updatedStreak,
          studyMinutes: updatedStudyMinutes
        });
        
        window.dispatchEvent(new CustomEvent("henosis-data-synced"));
      }
      
      setRewardMessage(\`Thành công! Đã ban tặng cho \${chosenUser.name}: \${addPoints >= 0 ? '+' : ''}\${addPoints} PT | \${addLevel >= 0 ? '+' : ''}\${addLevel} Lvl | \${addStreak >= 0 ? '+' : ''}\${addStreak} Streak | \${addStudyMinutes >= 0 ? '+' : ''}\${addStudyMinutes} Phút.\`);
      
      // Clean up inputs
      setRewardPoints("");
      setRewardLevels("");
      setRewardStreak("");
      setRewardStudyMinutes("");`;

content = content.replace(oldHandleDispatch, newHandleDispatch);

const oldUI = `<div className="grid grid-cols-1 md:grid-cols-4 gap-4 items-end">`;
const newUI = `<div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-5 gap-4 items-end">`;
content = content.replace(oldUI, newUI);

content = content.replace(
  /\{dbUsers\.map\(u => \{/g,
  `{dbUsers.filter(u => !u.isAnonymous && !(u.email || "").includes("anonymous@local")).map(u => {`
);

const streakUI = `
              <div>
                <label className="block text-xs font-bold mb-1 opacity-80">Chuỗi ngày (Streak)</label>
                <input
                  type="text"
                  placeholder="Ví dụ: +1 hoặc -1"
                  value={rewardStreak}
                  onChange={(e) => setRewardStreak(e.target.value)}
                  className="w-full bg-stone-100 dark:bg-zinc-900 border border-stone-300 dark:border-zinc-800 rounded-xl p-2.5 text-xs text-center font-mono font-bold"
                />
              </div>

              <div>
                <label className="block text-xs font-bold mb-1 opacity-80">Số phút học (Study Mins)</label>
                <input
                  type="text"
                  placeholder="Ví dụ: +30 hoặc -15"
                  value={rewardStudyMinutes}
                  onChange={(e) => setRewardStudyMinutes(e.target.value)}
                  className="w-full bg-stone-100 dark:bg-zinc-900 border border-stone-300 dark:border-zinc-800 rounded-xl p-2.5 text-xs text-center font-mono font-bold"
                />
              </div>
`;

content = content.replace(
  /<div>\s*<button\s*type="button"\s*onClick=\{handleDispatchReward\}/,
  `${streakUI}\n              <div className="lg:col-span-5 mt-2">\n                <button\n                  type="button"\n                  onClick={handleDispatchReward}`
);

fs.writeFileSync("src/pages/TeacherDashboard.tsx", content);
console.log("Teacher dashboard updated successfully!");
