from __future__ import annotations

from collections.abc import Mapping
from typing import Any, TypeVar, BinaryIO, TextIO, TYPE_CHECKING, Generator

from attrs import define as _attrs_define
from attrs import field as _attrs_field

from ..types import UNSET, Unset

from ..types import UNSET, Unset
from typing import cast
from typing import Literal, cast






T = TypeVar("T", bound="GadgetConfigInputType2")



@_attrs_define
class GadgetConfigInputType2:
    """ 
        Attributes:
            type_ (Literal['activity']):
            project_key (None | str | Unset):
            limit (int | Unset):  Default: 10.
     """

    type_: Literal['activity']
    project_key: None | str | Unset = UNSET
    limit: int | Unset = 10
    additional_properties: dict[str, Any] = _attrs_field(init=False, factory=dict)





    def to_dict(self) -> dict[str, Any]:
        type_ = self.type_

        project_key: None | str | Unset
        if isinstance(self.project_key, Unset):
            project_key = UNSET
        else:
            project_key = self.project_key

        limit = self.limit


        field_dict: dict[str, Any] = {}
        field_dict.update(self.additional_properties)
        field_dict.update({
            "type": type_,
        })
        if project_key is not UNSET:
            field_dict["projectKey"] = project_key
        if limit is not UNSET:
            field_dict["limit"] = limit

        return field_dict



    @classmethod
    def from_dict(cls: type[T], src_dict: Mapping[str, Any]) -> T:
        d = dict(src_dict)
        type_ = cast(Literal['activity'] , d.pop("type"))
        if type_ != 'activity':
            raise ValueError(f"type must match const 'activity', got '{type_}'")

        def _parse_project_key(data: object) -> None | str | Unset:
            if data is None:
                return data
            if isinstance(data, Unset):
                return data
            return cast(None | str | Unset, data)

        project_key = _parse_project_key(d.pop("projectKey", UNSET))


        limit = d.pop("limit", UNSET)

        gadget_config_input_type_2 = cls(
            type_=type_,
            project_key=project_key,
            limit=limit,
        )


        gadget_config_input_type_2.additional_properties = d
        return gadget_config_input_type_2

    @property
    def additional_keys(self) -> list[str]:
        return list(self.additional_properties.keys())

    def __getitem__(self, key: str) -> Any:
        return self.additional_properties[key]

    def __setitem__(self, key: str, value: Any) -> None:
        self.additional_properties[key] = value

    def __delitem__(self, key: str) -> None:
        del self.additional_properties[key]

    def __contains__(self, key: str) -> bool:
        return key in self.additional_properties
