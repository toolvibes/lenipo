from __future__ import annotations

from collections.abc import Mapping
from typing import Any, TypeVar, BinaryIO, TextIO, TYPE_CHECKING, Generator

from attrs import define as _attrs_define
from attrs import field as _attrs_field

from ..types import UNSET, Unset

from ..models.diff_block_type_0_op import DiffBlockType0Op
from typing import cast

if TYPE_CHECKING:
  from ..models.diff_block_content import DiffBlockContent





T = TypeVar("T", bound="DiffBlockType0")



@_attrs_define
class DiffBlockType0:
    """ 
        Attributes:
            op (DiffBlockType0Op):
            block (DiffBlockContent):
     """

    op: DiffBlockType0Op
    block: DiffBlockContent





    def to_dict(self) -> dict[str, Any]:
        from ..models.diff_block_content import DiffBlockContent # noqa: PLC0415
        op = self.op.value

        block = self.block.to_dict()


        field_dict: dict[str, Any] = {}

        field_dict.update({
            "op": op,
            "block": block,
        })

        return field_dict



    @classmethod
    def from_dict(cls: type[T], src_dict: Mapping[str, Any]) -> T:
        from ..models.diff_block_content import DiffBlockContent # noqa: PLC0415
        d = dict(src_dict)
        op = DiffBlockType0Op(d.pop("op"))




        block = DiffBlockContent.from_dict(d.pop("block"))




        diff_block_type_0 = cls(
            op=op,
            block=block,
        )

        return diff_block_type_0

