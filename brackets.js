let clickedRound = 0;
let clickedTable = 0;
let usersCollectionData = [];
let doubleBracket = false;
let finalBracket = false;
let winnerBracket = true;
let tournamentUsers = [];

const tournamentCollection = firebase.firestore().collection("tournaments");
const userCollection = firebase.firestore().collection("users");
const auth = firebase.auth();

const render_fn = (container, data, _, state) => {
  switch (state) {
    case "empty-bye":
      container.append(`BYE`);
      return;
    case "empty-tbd":
      container.append(`TBD`);
      return;
    case "entry-no-score":
    case "entry-default-win":
    case "entry-complete":
      const [teamName, teamAvatar] = data.split("^^^");
      container
        .append(
          `<img src=${
            teamAvatar
              ? teamAvatar
              : "https://firebasestorage.googleapis.com/v0/b/brackot/o/BrackotLogo2.jpg?alt=media&token=7bdf6862-64ec-4db7-9666-3e2865d2cdbe"
          } width="24px" height="24px" /> `
        )
        .append(teamName);
      return;
  }
};

const getUserData = (userId) => {
  let userName;
  let id;
  let avatarUrl;
  return userCollection
    .doc(userId)
    .get()
    .then((userDoc) => {
      userName = userDoc.data().name;
      avatarUrl = userDoc.data().avatarUrl || "";
      id = userDoc.id;
      tournamentUsers.push({
        id,
        userName,
        url: avatarUrl,
      });
      return `${userName}^^^${avatarUrl}`;
    });
};

const initBracket = (type, participantNumber) => {
  const matchResults = [];
  let i = 2;
  let index = 0;

  if (type === "Single Elimination") {
    while (participantNumber / i >= 1) {
      matchResults.push(
        new Array(participantNumber / i)
          .fill("")
          .map((_, idx) => [null, null, `${index + 1}^^^${idx + 1}`])
      );
      index++;
      i *= 2;
    }
    matchResults[matchResults.length - 1].push([null, null, `${index}^^^2`]);

    return matchResults;
  } else if (type === "Double Elimination") {
    const winnerBrackets = [],
      loserBrackets = [];
    index = 0;
    while (participantNumber / i >= 1) {
      winnerBrackets.push(
        new Array(participantNumber / i)
          .fill("")
          .map((_, idx) => [null, null, `${index + 1}^^^${idx + 1}^^^winner`])
      );
      index++;
      i *= 2;
    }

    const winnerNumber = winnerBrackets[0].length;
    i = 2;
    index = 0;
    while (winnerNumber / i >= 1) {
      loserBrackets.push(
        new Array(winnerNumber / i)
          .fill("")
          .map((_, idx) => [null, null, `${index + 1}^^^${idx + 1}^^^loser`])
      );
      loserBrackets.push(
        new Array(winnerNumber / i)
          .fill("")
          .map((_, idx) => [null, null, `${index + 2}^^^${idx + 1}^^^loser`])
      );
      index += 2;
      i *= 2;
    }

    const finalBrackets = [
      [
        [null, null, "1^^^1^^^final"],
        [null, null, "1^^^2^^^final"],
      ],
      [[null, null, "2^^^1^^^final"]],
    ];

    return [winnerBrackets, loserBrackets, finalBrackets];
  }
};

/*================================================NEW BRACKET COMPONENT=================================================*/
class BracketComponent extends React.Component {
  constructor(props) {
    super(props);
    this.state = {
      teamNames: [],
      teamScores: [],
      bracketType: "Single Elimination",
      availbleForBracket: false,
    };
  }

  async componentDidMount() {
    document.getElementById("upperParticipantScoreInput").value = 0;
    document.getElementById("lowerParticipantScoreInput").value = 0;

    const tournamentDoc = await tournamentCollection.doc(tournamentId).get();
    const {
      shuffledParticipants,
      bracket,
      bracketType,
      tournamentStatus,
    } = tournamentDoc.data();
    const users = await Promise.all(
      shuffledParticipants.map((participant) => getUserData(participant))
    );
    usersCollectionData = users;
    const participantNumber = shuffledParticipants.length + 1;
    const desiredParticpants = Math.pow(
      2,
      Math.round(Math.log(participantNumber) / Math.log(2))
    );
    const renderBrackets = initBracket(bracketType, desiredParticpants);

    if (bracketType === "Single Elimination") {
      (bracket || []).forEach((single) => {
        // Winner Bracket Only
        renderBrackets[single.round - 1][single.table - 1] = [
          single.teamOneScore,
          single.teamTwoScore,
          `${single.round}^^^${single.table}`,
        ];
      });
    } else if (bracketType === "Double Elimination") {
      (bracket || []).forEach((single) => {
        // Winner Bracket Only
        if (single.isFinal)
          renderBrackets[2][single.round - 1][single.table - 1] = [
            single.teamOneScore,
            single.teamTwoScore,
            `${single.round}^^^${single.table}^^^final`,
          ];
        else if (single.isWinner)
          renderBrackets[0][single.round - 1][single.table - 1] = [
            single.teamOneScore,
            single.teamTwoScore,
            `${single.round}^^^${single.table}^^^winner`,
          ];
        else
          renderBrackets[1][single.round - 1][single.table - 1] = [
            single.teamOneScore,
            single.teamTwoScore,
            `${single.round}^^^${single.table}^^^loser`,
          ];
      });
    }

    const userData = [];
    for (let i = 0; i < users.length; i += 2) {
      userData.push([users[i], users[i + 1] || null]);
    }
    userData.push(
      ...new Array(desiredParticpants / 2 - userData.length)
        .fill("")
        .map((_) => [null, null])
    );

    this.setState({
      teamNames: userData,
      teamScores: renderBrackets,
      availbleForBracket:
        tournamentStatus === "inProgress" || tournamentStatus === "completed",
      bracketType,
    });

    tournamentCollection.doc(tournamentId).onSnapshot((snapshot) => {
      const { bracket, reports, creator } = snapshot.data();
      const renderBrackets = initBracket(bracketType, desiredParticpants);

      if (bracketType === "Single Elimination") {
        (bracket || []).forEach((single) => {
          // Winner Bracket Only
          renderBrackets[single.round - 1][single.table - 1] = [
            single.teamOneScore,
            single.teamTwoScore,
            `${single.round}^^^${single.table}`,
          ];
        });
      } else if (bracketType === "Double Elimination") {
        (bracket || []).forEach((single) => {
          // Winner Bracket Only
          if (single.isFinal)
            renderBrackets[2][single.round - 1][single.table - 1] = [
              single.teamOneScore,
              single.teamTwoScore,
              `${single.round}^^^${single.table}^^^final`,
            ];
          else if (single.isWinner)
            renderBrackets[0][single.round - 1][single.table - 1] = [
              single.teamOneScore,
              single.teamTwoScore,
              `${single.round}^^^${single.table}^^^winner`,
            ];
          else
            renderBrackets[1][single.round - 1][single.table - 1] = [
              single.teamOneScore,
              single.teamTwoScore,
              `${single.round}^^^${single.table}^^^loser`,
            ];
        });
      }

      this.setState({
        teamNames: userData,
        teamScores: renderBrackets,
        bracketType,
      });

      if (creator === auth.currentUser.uid && reports && reports.length) {
        let grouped = (reports || []).reduce((r, a) => {
          const key = `Round ${a.round}, Table ${a.table}`;
          r[key] = [...(r[key] || []), a];
          return r;
        }, {});
        const disputedMatches = [];
        Object.keys(grouped).map((roundKey) => {
          const testMatches = grouped[roundKey];
          const resultTeamOne = testMatches[0].teamOneScore;
          const resultTeamTwo = testMatches[0].teamTwoScore;
          const isIdentical = testMatches.every((match) => {
            return (
              match.teamOneScore === resultTeamOne &&
              match.teamTwoScore === resultTeamTwo
            );
          });
          if (!isIdentical) disputedMatches.push(roundKey);
        });
        if (disputedMatches.length > 0) {
          document.getElementById("alertBox").style.display = "block";
          document.getElementById("alertBox").classList.add("errorAlert");
          document.getElementById("alertTextBold").innerHTML = "Error: ";
          document.getElementById("alertText").innerHTML =
            "Disputed Match Records Reported For " + disputedMatches.join(",");
        }
      } else {
        document.getElementById("alertBox").style.display = "none";
      }
    });
  }

  UNSAFE_componentWillUpdate(_, state) {
    this.renderTournamentBracket(state);
  }

  renderTournamentBracket(state) {
    if (!state.availbleForBracket) return;
    if (state.teamNames.length > 0) {
      if (window.innerWidth >= 1024) initDragAndDrop();
      let results = [];
      let options = {};
      if (state.bracketType === "Single Elimination") {
        results = [state.teamScores];
        options = {
          skipConsolationRound: true,
        };
      } else if (state.bracketType === "Double Elimination") {
        results = state.teamScores;
        options = {
          skipSecondaryFinal: true,
          skipConsolationRound: true,
        };
      }
      $("div#bracket-render").bracket({
        init: {
          teams: state.teamNames,
          results,
        },
        teamWidth: 180,
        scoreWidth: 40,
        roundMargin: 40,
        matchMargin: 40,
        ...options,
        decorator: {
          render: render_fn,
          edit: () => {},
        },
        onMatchClick: (data) => {
          if (data === undefined) return;
          const [round, table, double] = data.split("^^^");
          const bracketType = state.bracketType;
          if (!double)
            openMatchModal(bracketType, round, table, state.teamScores);
          else
            openMatchModal(bracketType, round, table, state.teamScores, double);
        },
      });
    }
  }

  render() {
    return <div id="bracket-render" style={{ width: "100%" }}></div>;
  }
}

//Local functions used to render the bracket and other client-side functions
const renderMatchCards = () => {
  ReactDOM.render(
    <BracketComponent />,
    document.getElementById("bracket-renderer")
  );
};

const openMatchModal = async (bracketType, round, table, bracket, double) => {
  if (bracketType === "Single Elimination") {
    const [teamOneScore, teamTwoScore] = bracket[round - 1][table - 1];

    let tableIndex, upperUser, lowerUser;

    if (+round === 1) {
      tableIndex = +table * 2;
      if (usersCollectionData.length < tableIndex) return;
      upperUser = usersCollectionData[tableIndex - 2].split("^^^");
      lowerUser = usersCollectionData[tableIndex - 1].split("^^^");
    } else {
      const compTable = +table * 2 - 2;
      const prevUpper = bracket[round - 2][compTable];
      const prevLower = bracket[round - 2][compTable + 1];
      const isBYE =
        +round === 2 && 2 * (compTable + 2) > usersCollectionData.length;
      // if (!isBYE && (prevUpper[0] === null || prevUpper[1] === null || prevLower[0] === null || prevLower[1] === null)) return;
      const startTable = findParentTable(+round - 1, +table * 2 - 1, bracket);
      const startIndex =
        bracket[0][startTable - 1][0] >= bracket[0][startTable - 1][1]
          ? startTable * 2 - 2
          : startTable * 2 - 1;

      const endTable = findParentTable(+round - 1, +table * 2, bracket);
      const endIndex =
        bracket[0][endTable - 1][0] >= bracket[0][endTable - 1][1]
          ? endTable * 2 - 2
          : endTable * 2 - 1;
      upperUser = usersCollectionData[startIndex].split("^^^");
      lowerUser = usersCollectionData[endIndex].split("^^^");
    }

    const modal = document.getElementById("matchModal");
    modal.style.display = "block";

    document.getElementById(
      "upperParticipantScoreModal"
    ).innerHTML = teamOneScore;
    document.getElementById(
      "lowerParticipantScoreModal"
    ).innerHTML = teamTwoScore;

    document.getElementById("upperParticipantNameModal").innerHTML =
      upperUser[0];
    document.getElementById("lowerParticipantNameModal").innerHTML =
      lowerUser[0];
    document.getElementById("upperParticipantPicModal").src =
      upperUser[1] || "media/BrackotLogo2.jpg";
    document.getElementById("lowerParticipantPicModal").src =
      lowerUser[1] || "media/BrackotLogo2.jpg";
    clickedRound = round;
    clickedTable = table;
  } else {
    let teamOneScore, teamTwoScore;
    if (double === "final")
      [teamOneScore, teamTwoScore] = bracket[2][round - 1][table - 1];
    else if (double === "winner")
      [teamOneScore, teamTwoScore] = bracket[0][round - 1][table - 1];
    else [teamOneScore, teamTwoScore] = bracket[1][round - 1][table - 1];

    const modal = document.getElementById("matchModal");
    modal.style.display = "block";

    document.getElementById(
      "upperParticipantScoreModal"
    ).innerHTML = teamOneScore;
    document.getElementById(
      "lowerParticipantScoreModal"
    ).innerHTML = teamTwoScore;

    document.getElementById("upperParticipantNameModal").innerHTML = "First";
    document.getElementById("lowerParticipantNameModal").innerHTML = "Second";
    document.getElementById("upperParticipantPicModal").src =
      "media/BrackotLogo2.jpg";
    document.getElementById("lowerParticipantPicModal").src =
      "media/BrackotLogo2.jpg";
    doubleBracket = true;
    winnerBracket = double === "winner";
    finalBracket = double === "final";
    clickedRound = round;
    clickedTable = table;
  }
};

const findParentTable = (round, table, bracket) => {
  if (round === 1) return table;
  const matchRecord = bracket[round - 1][table - 1];
  const tableId = matchRecord[0] > matchRecord[1] ? table * 2 - 1 : table * 2;
  return findParentTable(round - 1, tableId, bracket);
};

const closeMatchModal = () => {
  const modal = document.getElementById("matchModal");
  modal.style.display = "none";
  clickedRound = 0;
  clickedTable = 0;
};

const editMatchScores = () => {
  document.getElementById(
    "upperParticipantScoreInput"
  ).value = +document.getElementById("upperParticipantScoreModal").innerHTML;
  document.getElementById(
    "lowerParticipantScoreInput"
  ).value = +document.getElementById("lowerParticipantScoreModal").innerHTML;
  document.getElementById("editScoresButton").style.display = "none";
  document.getElementById("submitResultsButton").style.display = "block";
  document.getElementById("upperParticipantScoreInput").style.display =
    "inline-block";
  document.getElementById("lowerParticipantScoreInput").style.display =
    "inline-block";
  document.getElementById("upperParticipantScoreModal").style.display = "none";
  document.getElementById("lowerParticipantScoreModal").style.display = "none";
};

//Functions done locally reagrding updating data that need to be moved to a cloud function
const startTournament = () => {
  tournamentCollection
    .doc(tournamentId)
    .get()
    .then((tournamentDataDoc) => {
      const { players } = tournamentDataDoc.data();
      const playerCount = players.length;
      const shuffledParticipants = players;

      for (let i = playerCount - 1; i > 0; i--) {
        const j = Math.floor(Math.random() * i);
        const temp = shuffledParticipants[i];
        shuffledParticipants[i] = shuffledParticipants[j];
        shuffledParticipants[j] = temp;
      }

      tournamentCollection
        .doc(tournamentId)
        .update({
          tournamentStatus: "inProgress",
          shuffledParticipants: shuffledParticipants,
        })
        .then(() => {
          document.getElementById("bracketNavbar").style.display =
            "inline-block";
          document.getElementById("tournamentSignUpButton").className =
            "tournamentCardButton tournamentCardButtonInProgress";
          document.getElementById("tournamentSignUpButton").innerHTML =
            "Tournament In Progress";
          document.getElementById("tournamentSignUpButton").disabled = true;
        })
        .catch((err) => {
          const errMessage =
            err.code === "permission-denied"
              ? "You don't have any access to start this tournament"
              : err.toString();
          document.getElementById("alertBox").style.display = "block";
          document.getElementById("alertBox").classList.add("errorAlert");
          document.getElementById("alertTextBold").innerHTML = "Error: ";
          document.getElementById("alertText").innerHTML =
            "Failed to start the tournament: " + errMessage;
        });
    });
};

/* *** SAVE MATCH SCORES functions ***
   - uploads scores edited in match modal to firebase
   - changes scores in match object (allows the assign winner function to work)
*/
const saveMatchScores = async () => {
  const tournamentDataDoc = await tournamentCollection.doc(tournamentId).get();
  const tournamentData = tournamentDataDoc.data();
  const {
    bracket,
    creator,
    reports,
    tournamentStatus,
    shuffledParticipants,
  } = tournamentData;
  const myUserId = auth.currentUser.uid;
  let newBracketData;
  if (!doubleBracket) {
    newBracketData = {
      round: +clickedRound,
      table: +clickedTable,
      teamOneScore: +document.getElementById("upperParticipantScoreInput")
        .value,
      teamTwoScore: +document.getElementById("lowerParticipantScoreInput")
        .value,
    };
  } else if (!finalBracket) {
    newBracketData = {
      round: +clickedRound,
      table: +clickedTable,
      teamOneScore: +document.getElementById("upperParticipantScoreInput")
        .value,
      teamTwoScore: +document.getElementById("lowerParticipantScoreInput")
        .value,
      isWinner: winnerBracket,
    };
  } else {
    newBracketData = {
      round: +clickedRound,
      table: +clickedTable,
      teamOneScore: +document.getElementById("upperParticipantScoreInput")
        .value,
      teamTwoScore: +document.getElementById("lowerParticipantScoreInput")
        .value,
      isFinal: true,
    };
  }
  let newBracket = [];
  let findIndex;
  if (!doubleBracket)
    findIndex = (bracket || []).findIndex(
      (single) =>
        single.round === +clickedRound && single.table === +clickedTable
    );
  else
    findIndex = (bracket || []).findIndex(
      (single) =>
        single.round === +clickedRound &&
        single.table === +clickedTable &&
        single.isWinner === winnerBracket &&
        single.isFinal === finalBracket
    );
  if (findIndex === -1) {
    newBracket = [...(bracket || []), newBracketData];
  } else {
    newBracket = [...bracket];
    newBracket[findIndex] = newBracketData;
  }

  const participantNumber = shuffledParticipants.length + 1;
  const desiredParticpants = Math.pow(
    2,
    Math.round(Math.log(participantNumber) / Math.log(2))
  );

  return Promise.resolve(true)
    .then(() => {
      let updatedStatus = tournamentStatus;
      if (finalBracket) {
        updatedStatus === "completed";
      } else if (Math.log(desiredParticpants) / Math.log(2) === +clickedRound) {
        updatedStatus === "completed";
      }
      if (myUserId === creator || findIndex === -1) {
        const newReports = (reports || []).filter(
          (report) =>
            !(report.round === +clickedRound && report.table === +clickedTable)
        );
        return tournamentCollection.doc(tournamentId).set({
          ...tournamentData,
          bracket: newBracket,
          reports: newReports,
        });
      }

      let newReports = [];
      const reportfindIndex = (reports || []).findIndex(
        (single) =>
          single.round === +clickedRound && single.table === +clickedTable
      );
      if (reportfindIndex === -1) {
        newReports = [...(reports || []), newBracketData];
      } else {
        newReports = [...reports];
        if (
          reports[findIndex].teamOneScore !== newBracketData.teamOneScore ||
          reports[findIndex].teamTwoScore !== newBracketData.teamTwoScore
        ) {
          newReports.push(newBracketData);
        }
      }
      return tournamentCollection.doc(tournamentId).set({
        ...tournamentData,
        reports: newReports,
        tournamentStatus: updatedStatus,
      });
    })
    .then(() => {
      document.getElementById("editScoresButton").style.display = "block";
      document.getElementById("submitResultsButton").style.display = "none";
      document.getElementById("upperParticipantScoreInput").style.display =
        "none";
      document.getElementById("lowerParticipantScoreInput").style.display =
        "none";
      document.getElementById("upperParticipantScoreModal").style.display =
        "inline-block";
      document.getElementById("lowerParticipantScoreModal").style.display =
        "inline-block";
      document.getElementById("upperParticipantScoreModal").innerHTML =
        newBracketData.teamOneScore;
      document.getElementById("lowerParticipantScoreModal").innerHTML =
        newBracketData.teamTwoScore;
      document.getElementById("upperParticipantScoreInput").value = 0;
      document.getElementById("upperParticipantScoreInput").value = 0;
    });
};

var currentMobileRound = 1;
function changeRoundMobile(action) {
  tournamentCollection
    .doc(tournamentId)
    .get()
    .then(function (doc) {
      var maxRound = getByesAndRounds()[1];
      document.getElementById(
        "matchColumn" + currentMobileRound
      ).style.display = "none";
      if (action == "previous" && currentMobileRound > 1) {
        currentMobileRound -= 1;
      }
      if (action == "next" && currentMobileRound < maxRound) {
        currentMobileRound += 1;
      }
      document.getElementById(
        "matchColumn" + currentMobileRound
      ).style.display = "inline-block";
      if (currentMobileRound != maxRound) {
        document.getElementById("bracketRoundMobileText").innerHTML =
          "Round " + currentMobileRound;
      } else {
        document.getElementById("bracketRoundMobileText").innerHTML =
          "Final Round";
      }
    });
}

window.addEventListener("resize", () => {
  if (window.innerWidth <= 468)
    document.getElementById("bracket-render").style.overflow = "auto";
  else
    document.getElementById("bracket-render").style.overflow = "hidden";
});
