from __future__ import annotations

from collections.abc import Mapping
from typing import Any, TypeVar, BinaryIO, TextIO, TYPE_CHECKING, Generator

from attrs import define as _attrs_define
from attrs import field as _attrs_field

from ..types import UNSET, Unset

from ..types import UNSET, Unset






T = TypeVar("T", bound="HandoverRequest")



@_attrs_define
class HandoverRequest:
    """ 
        Attributes:
            done (str):
            open_ (str | Unset):  Default: ''.
            notes (str | Unset):  Default: ''.
            to (str | Unset):
     """

    done: str
    open_: str | Unset = ''
    notes: str | Unset = ''
    to: str | Unset = UNSET
    additional_properties: dict[str, Any] = _attrs_field(init=False, factory=dict)





    def to_dict(self) -> dict[str, Any]:
        done = self.done

        open_ = self.open_

        notes = self.notes

        to = self.to


        field_dict: dict[str, Any] = {}
        field_dict.update(self.additional_properties)
        field_dict.update({
            "done": done,
        })
        if open_ is not UNSET:
            field_dict["open"] = open_
        if notes is not UNSET:
            field_dict["notes"] = notes
        if to is not UNSET:
            field_dict["to"] = to

        return field_dict



    @classmethod
    def from_dict(cls: type[T], src_dict: Mapping[str, Any]) -> T:
        d = dict(src_dict)
        done = d.pop("done")

        open_ = d.pop("open", UNSET)

        notes = d.pop("notes", UNSET)

        to = d.pop("to", UNSET)

        handover_request = cls(
            done=done,
            open_=open_,
            notes=notes,
            to=to,
        )


        handover_request.additional_properties = d
        return handover_request

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
