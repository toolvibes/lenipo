from __future__ import annotations

from collections.abc import Mapping
from typing import Any, TypeVar, BinaryIO, TextIO, TYPE_CHECKING, Generator

from attrs import define as _attrs_define
from attrs import field as _attrs_field

from ..types import UNSET, Unset

from typing import cast
from typing import Literal, cast






T = TypeVar("T", bound="GadgetConfigType2")



@_attrs_define
class GadgetConfigType2:
    """ 
        Attributes:
            type_ (Literal['activity']):
            project_key (None | str):
            limit (int):  Default: 10.
     """

    type_: Literal['activity']
    project_key: None | str
    limit: int = 10





    def to_dict(self) -> dict[str, Any]:
        type_ = self.type_

        project_key: None | str
        project_key = self.project_key

        limit = self.limit


        field_dict: dict[str, Any] = {}

        field_dict.update({
            "type": type_,
            "projectKey": project_key,
            "limit": limit,
        })

        return field_dict



    @classmethod
    def from_dict(cls: type[T], src_dict: Mapping[str, Any]) -> T:
        d = dict(src_dict)
        type_ = cast(Literal['activity'] , d.pop("type"))
        if type_ != 'activity':
            raise ValueError(f"type must match const 'activity', got '{type_}'")

        def _parse_project_key(data: object) -> None | str:
            if data is None:
                return data
            return cast(None | str, data)

        project_key = _parse_project_key(d.pop("projectKey"))


        limit = d.pop("limit")

        gadget_config_type_2 = cls(
            type_=type_,
            project_key=project_key,
            limit=limit,
        )

        return gadget_config_type_2

