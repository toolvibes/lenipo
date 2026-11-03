from __future__ import annotations

from collections.abc import Mapping
from typing import Any, TypeVar, BinaryIO, TextIO, TYPE_CHECKING, Generator

from attrs import define as _attrs_define
from attrs import field as _attrs_field

from ..types import UNSET, Unset

from typing import cast
from uuid import UUID






T = TypeVar("T", bound="OnboardingResult")



@_attrs_define
class OnboardingResult:
    """ 
        Attributes:
            board_id (None | UUID):
            space_key (None | str):
     """

    board_id: None | UUID
    space_key: None | str





    def to_dict(self) -> dict[str, Any]:
        board_id: None | str
        if isinstance(self.board_id, UUID):
            board_id = str(self.board_id)
        else:
            board_id = self.board_id

        space_key: None | str
        space_key = self.space_key


        field_dict: dict[str, Any] = {}

        field_dict.update({
            "boardId": board_id,
            "spaceKey": space_key,
        })

        return field_dict



    @classmethod
    def from_dict(cls: type[T], src_dict: Mapping[str, Any]) -> T:
        d = dict(src_dict)
        def _parse_board_id(data: object) -> None | UUID:
            if data is None:
                return data
            try:
                if not isinstance(data, str):
                    raise TypeError()
                board_id_type_0 = UUID(data)



                return board_id_type_0
            except (TypeError, ValueError, AttributeError, KeyError):
                pass
            return cast(None | UUID, data)

        board_id = _parse_board_id(d.pop("boardId"))


        def _parse_space_key(data: object) -> None | str:
            if data is None:
                return data
            return cast(None | str, data)

        space_key = _parse_space_key(d.pop("spaceKey"))


        onboarding_result = cls(
            board_id=board_id,
            space_key=space_key,
        )

        return onboarding_result

