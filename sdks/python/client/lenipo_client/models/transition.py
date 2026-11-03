from __future__ import annotations

from collections.abc import Mapping
from typing import Any, TypeVar, BinaryIO, TextIO, TYPE_CHECKING, Generator

from attrs import define as _attrs_define
from attrs import field as _attrs_field

from ..types import UNSET, Unset

from ..models.transition_comment import TransitionComment
from typing import cast

if TYPE_CHECKING:
  from ..models.status_info import StatusInfo





T = TypeVar("T", bound="Transition")



@_attrs_define
class Transition:
    """ 
        Attributes:
            id (str):
            name (str):
            to (StatusInfo):
            sets_resolution (bool):
            required_fields (list[str]):
            comment (TransitionComment):
            screen (bool):
     """

    id: str
    name: str
    to: StatusInfo
    sets_resolution: bool
    required_fields: list[str]
    comment: TransitionComment
    screen: bool





    def to_dict(self) -> dict[str, Any]:
        from ..models.status_info import StatusInfo # noqa: PLC0415
        id = self.id

        name = self.name

        to = self.to.to_dict()

        sets_resolution = self.sets_resolution

        required_fields = self.required_fields



        comment = self.comment.value

        screen = self.screen


        field_dict: dict[str, Any] = {}

        field_dict.update({
            "id": id,
            "name": name,
            "to": to,
            "setsResolution": sets_resolution,
            "requiredFields": required_fields,
            "comment": comment,
            "screen": screen,
        })

        return field_dict



    @classmethod
    def from_dict(cls: type[T], src_dict: Mapping[str, Any]) -> T:
        from ..models.status_info import StatusInfo # noqa: PLC0415
        d = dict(src_dict)
        id = d.pop("id")

        name = d.pop("name")

        to = StatusInfo.from_dict(d.pop("to"))




        sets_resolution = d.pop("setsResolution")

        required_fields = cast(list[str], d.pop("requiredFields"))


        comment = TransitionComment(d.pop("comment"))




        screen = d.pop("screen")

        transition = cls(
            id=id,
            name=name,
            to=to,
            sets_resolution=sets_resolution,
            required_fields=required_fields,
            comment=comment,
            screen=screen,
        )

        return transition

