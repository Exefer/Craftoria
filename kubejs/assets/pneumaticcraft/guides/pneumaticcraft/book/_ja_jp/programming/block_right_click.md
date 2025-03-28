---
navigation:
  title: "右クリックウィジェット"
  icon: "pneumaticcraft:textures/progwidgets/block_right_click_piece.png"
  parent: pneumaticcraft:widget_interact.md
---

# 右クリックウィジェット

ドローンは接続された[エリア](./area.md)ウィジェット内のすべてのブロック位置に対して、最初のインベントリスロットにあるアイテムで*右クリック*します。これを使用して地面を耕したり、種を蒔いたり、骨粉を適用したり、ポーションを投げたり、ドローンを展開したり、レンチでブロックを回転させたりすることができます...可能性は無限です。

このウィジェットはプログラマーのウィジェットGUIから選択可能な2つのモードのいずれかで動作します:
- アイテムモード - *保持アイテムの*右クリックロジック(例: ブロックで*火打石と打ち金*を使用する)を使用します。
- ブロックモード - *ブロックの*右クリックロジックをアクティブ(例: *レバー*を反転する)にします。

*アイテムモード*では添付されているフィルターは使用されている*アイテム*に適用されます。*ブロックモード*ではアクティブ化されている*ブロック*にフィルターが適用されます。

このウィジェットを使用して通常のブロックを配置することができます。ただしこれは推奨*されません*。ドローンがブロックがすでに存在する位置を右クリックすると、ブロックを右クリックしてブロック自体ではなくこのブロックの*隣*にブロックを配置することになるからです。

これらの理由から[配置](./place.md)ウィジェットの使用が推奨されます。ただし、*ブロックを右クリック*ウィジェットが必要な状況(例: *種*を植える場合)もあります。

*右クリックウィジェット*

![](block_right_click_piece.png)

