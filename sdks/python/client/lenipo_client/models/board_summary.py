from __future__ import annotations

from collections.abc import Mapping
from typing import Any, TypeVar, BinaryIO, TextIO, TYPE_CHECKING, Generator

from attrs import define as _attrs_define
from attrs import field as _attrs_field

from ..types import UNSET, Unset

from ..models.board_summary_type import BoardSummaryType
from typing import cast
from uuid import UUID

if TYPE_CHECKING:
  from ..models.board_summary_project import BoardSummaryProject





T = TypeVar("T", bound="BoardSummary")



@_attrs_define
class BoardSummary:
    """ 
        Attributes:
            id (UUID):
            name (str):
            type_ (BoardSummaryType):
            project (BoardSummaryProject):
            favourite (bool):
     """

    id: UUID
    name: str
    type_: BoardSummaryType
    project: BoardSummaryProject
    favourite: bool





    def to_dict(self) -> dict[str, Any]:
        from ..models.board_summary_project import BoardSummaryProject # noqa: PLC0415
        id = str(self.id)

        name = self.name

        type_ = self.type_.value

        project = self.project.to_dict()

        favourite = self.favourite


        field_dict: dict[str, Any] = {}

        field_dict.update({
            "id": id,
            "name": name,
            "type": type_,
            "project": project,
            "favourite": favourite,
        })

        return field_dict



    @classmethod
    def from_dict(cls: type[T], src_dict: Mapping[str, Any]) -> T:
        from ..models.board_summary_project import BoardSummaryProject # noqa: PLC0415
        d = dict(src_dict)
        id = UUID(d.pop("id"))




        name = d.pop("name")

        type_ = BoardSummaryType(d.pop("type"))




        project = BoardSummaryProject.from_dict(d.pop("project"))




        favourite = d.pop("favourite")

        board_summary = cls(
            id=id,
            name=name,
            type_=type_,
            project=project,
            favourite=favourite,
        )

        return board_summary

