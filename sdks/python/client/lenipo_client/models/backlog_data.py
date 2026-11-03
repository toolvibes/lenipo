from __future__ import annotations

from collections.abc import Mapping
from typing import Any, TypeVar, BinaryIO, TextIO, TYPE_CHECKING, Generator

from attrs import define as _attrs_define
from attrs import field as _attrs_field

from ..types import UNSET, Unset

from typing import cast

if TYPE_CHECKING:
  from ..models.backlog_data_sprints_item import BacklogDataSprintsItem
  from ..models.board import Board
  from ..models.issue_summary import IssueSummary





T = TypeVar("T", bound="BacklogData")



@_attrs_define
class BacklogData:
    """ 
        Attributes:
            board (Board):
            sprints (list[BacklogDataSprintsItem]):
            backlog (list[IssueSummary]):
            truncated (bool):
     """

    board: Board
    sprints: list[BacklogDataSprintsItem]
    backlog: list[IssueSummary]
    truncated: bool





    def to_dict(self) -> dict[str, Any]:
        from ..models.backlog_data_sprints_item import BacklogDataSprintsItem # noqa: PLC0415
        from ..models.board import Board # noqa: PLC0415
        from ..models.issue_summary import IssueSummary # noqa: PLC0415
        board = self.board.to_dict()

        sprints = []
        for sprints_item_data in self.sprints:
            sprints_item = sprints_item_data.to_dict()
            sprints.append(sprints_item)



        backlog = []
        for backlog_item_data in self.backlog:
            backlog_item = backlog_item_data.to_dict()
            backlog.append(backlog_item)



        truncated = self.truncated


        field_dict: dict[str, Any] = {}

        field_dict.update({
            "board": board,
            "sprints": sprints,
            "backlog": backlog,
            "truncated": truncated,
        })

        return field_dict



    @classmethod
    def from_dict(cls: type[T], src_dict: Mapping[str, Any]) -> T:
        from ..models.backlog_data_sprints_item import BacklogDataSprintsItem # noqa: PLC0415
        from ..models.board import Board # noqa: PLC0415
        from ..models.issue_summary import IssueSummary # noqa: PLC0415
        d = dict(src_dict)
        board = Board.from_dict(d.pop("board"))




        sprints = []
        _sprints = d.pop("sprints")
        for sprints_item_data in (_sprints):
            sprints_item = BacklogDataSprintsItem.from_dict(sprints_item_data)



            sprints.append(sprints_item)


        backlog = []
        _backlog = d.pop("backlog")
        for backlog_item_data in (_backlog):
            backlog_item = IssueSummary.from_dict(backlog_item_data)



            backlog.append(backlog_item)


        truncated = d.pop("truncated")

        backlog_data = cls(
            board=board,
            sprints=sprints,
            backlog=backlog,
            truncated=truncated,
        )

        return backlog_data

