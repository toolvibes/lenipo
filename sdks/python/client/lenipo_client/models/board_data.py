from __future__ import annotations

from collections.abc import Mapping
from typing import Any, TypeVar, BinaryIO, TextIO, TYPE_CHECKING, Generator

from attrs import define as _attrs_define
from attrs import field as _attrs_field

from ..types import UNSET, Unset

from typing import cast

if TYPE_CHECKING:
  from ..models.board import Board
  from ..models.board_data_reachable import BoardDataReachable
  from ..models.issue_summary import IssueSummary
  from ..models.sprint import Sprint





T = TypeVar("T", bound="BoardData")



@_attrs_define
class BoardData:
    """ 
        Attributes:
            board (Board):
            sprint (None | Sprint):
            active_sprints (list[Sprint]):
            issues (list[IssueSummary]):
            truncated (bool):
            reachable (BoardDataReachable):
     """

    board: Board
    sprint: None | Sprint
    active_sprints: list[Sprint]
    issues: list[IssueSummary]
    truncated: bool
    reachable: BoardDataReachable





    def to_dict(self) -> dict[str, Any]:
        from ..models.board import Board # noqa: PLC0415
        from ..models.board_data_reachable import BoardDataReachable # noqa: PLC0415
        from ..models.issue_summary import IssueSummary # noqa: PLC0415
        from ..models.sprint import Sprint # noqa: PLC0415
        board = self.board.to_dict()

        sprint: dict[str, Any] | None
        if isinstance(self.sprint, Sprint):
            sprint = self.sprint.to_dict()
        else:
            sprint = self.sprint

        active_sprints = []
        for active_sprints_item_data in self.active_sprints:
            active_sprints_item = active_sprints_item_data.to_dict()
            active_sprints.append(active_sprints_item)



        issues = []
        for issues_item_data in self.issues:
            issues_item = issues_item_data.to_dict()
            issues.append(issues_item)



        truncated = self.truncated

        reachable = self.reachable.to_dict()


        field_dict: dict[str, Any] = {}

        field_dict.update({
            "board": board,
            "sprint": sprint,
            "activeSprints": active_sprints,
            "issues": issues,
            "truncated": truncated,
            "reachable": reachable,
        })

        return field_dict



    @classmethod
    def from_dict(cls: type[T], src_dict: Mapping[str, Any]) -> T:
        from ..models.board import Board # noqa: PLC0415
        from ..models.board_data_reachable import BoardDataReachable # noqa: PLC0415
        from ..models.issue_summary import IssueSummary # noqa: PLC0415
        from ..models.sprint import Sprint # noqa: PLC0415
        d = dict(src_dict)
        board = Board.from_dict(d.pop("board"))




        def _parse_sprint(data: object) -> None | Sprint:
            if data is None:
                return data
            try:
                if not isinstance(data, dict):
                    raise TypeError()
                sprint_type_0 = Sprint.from_dict(data)



                return sprint_type_0
            except (TypeError, ValueError, AttributeError, KeyError):
                pass
            return cast(None | Sprint, data)

        sprint = _parse_sprint(d.pop("sprint"))


        active_sprints = []
        _active_sprints = d.pop("activeSprints")
        for active_sprints_item_data in (_active_sprints):
            active_sprints_item = Sprint.from_dict(active_sprints_item_data)



            active_sprints.append(active_sprints_item)


        issues = []
        _issues = d.pop("issues")
        for issues_item_data in (_issues):
            issues_item = IssueSummary.from_dict(issues_item_data)



            issues.append(issues_item)


        truncated = d.pop("truncated")

        reachable = BoardDataReachable.from_dict(d.pop("reachable"))




        board_data = cls(
            board=board,
            sprint=sprint,
            active_sprints=active_sprints,
            issues=issues,
            truncated=truncated,
            reachable=reachable,
        )

        return board_data

